import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/admin';
import { LoginSchema } from '@/lib/utils/validators';
import { ok, err, parseIp, getUserAgent } from '@/lib/utils/response';
import { signSessionToken, setSessionCookie } from '@/lib/auth/session';
import {
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  attemptKey,
} from '@/lib/auth/throttle';
import { upsertDevice, generateSessionId, storeSession } from '@/lib/auth/device';
import { get2FASetup } from '@/lib/auth/twoFactor';
import {
  generateEmailOtp,
  storeEmailOtp,
} from '@/lib/auth/twoFactor';
import {
  send2FAOtpEmail,
  sendNewDeviceAlertEmail,
} from '@/lib/mail/client';
import { signOtpToken } from '@/lib/auth/session';
import type { User } from '@/types';

// Firebase REST API for password verification
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';

async function verifyPassword(
  email: string,
  password: string
): Promise<{ uid: string } | { error: string }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const code: string = data.error?.message ?? '';
    if (code.includes('INVALID_PASSWORD') || code.includes('EMAIL_NOT_FOUND')) {
      return { error: 'invalid_credentials' };
    }
    if (code.includes('USER_DISABLED')) return { error: 'account_disabled' };
    return { error: 'auth_error' };
  }
  return { uid: data.localId };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { email, password } = parsed.data;
  const ip = parseIp(request);
  const userAgent = getUserAgent(request);
  const key = attemptKey(ip, email);

  // Throttle check
  if (await isLockedOut(key)) {
    return err('Too many failed attempts. Try again in 15 minutes.', 429, 'ACCOUNT_LOCKED');
  }

  // Verify password via Firebase
  const authResult = await verifyPassword(email, password);
  if ('error' in authResult) {
    const result = await recordFailedAttempt(key);
    if (result.locked) {
      return err('Too many failed attempts. Account locked for 15 minutes.', 429, 'ACCOUNT_LOCKED');
    }
    return err(
      'Invalid email or password.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  const { uid } = authResult;

  // Load user from Firestore
  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return err('User record not found', 404);

  const user = userSnap.data() as User;

  if (!user.isActive) return err('Account is suspended. Contact support.', 403, 'ACCOUNT_SUSPENDED');
  if (user.isFrozen) return err('Account is frozen. Contact support.', 403, 'ACCOUNT_FROZEN');

  // Check email verification via Firebase Auth
  const firebaseUser = await getAuth().getUser(uid);
  if (!firebaseUser.emailVerified) {
    return err('Please verify your email address before logging in.', 403, 'EMAIL_NOT_VERIFIED');
  }

  // Clear failed attempts on success
  await clearAttempts(key);

  // Device tracking
  const { deviceId, isNewDevice } = await upsertDevice(uid, ip, userAgent);

  // 2FA check
  const twoFASetup = await get2FASetup(uid);
  if (twoFASetup?.isVerified) {
    // Issue a short-lived pre-auth token for the 2FA step
    const preAuthToken = await signOtpToken({ uid, purpose: '2fa_pre_auth' });

    if (twoFASetup.method === 'email_otp') {
      const otp = generateEmailOtp();
      await storeEmailOtp(uid, otp);
      await send2FAOtpEmail(email, otp, user.displayName).catch(console.error);
    }

    return ok(
      { requires2FA: true, method: twoFASetup.method, preAuthToken },
      '2FA verification required.'
    );
  }

  // Issue session
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await signSessionToken({ uid, email, roleId: user.roleId, sessionId, deviceId });
  await storeSession(uid, sessionId, deviceId, expiresAt);
  await setSessionCookie(token);

  // New device alert (non-blocking)
  if (isNewDevice) {
    sendNewDeviceAlertEmail(email, user.displayName, {
      ip,
      userAgent,
      time: new Date().toUTCString(),
    }).catch(console.error);
  }

  return ok(
    {
      uid,
      email,
      displayName: user.displayName,
      roleId: user.roleId,
      kycTier: user.kycTier,
    },
    'Logged in successfully.'
  );
}