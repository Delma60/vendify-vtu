import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { getSession, verifyOtpToken, signSessionToken, setSessionCookie } from '@/lib/auth/session';
import {
  enable2FA,
  confirm2FASetup,
  disable2FA,
  get2FASetup,
  verifyTotp,
  verifyEmailOtp,
  consumeBackupCode,
  buildTotpUri,
} from '@/lib/auth/twoFactor';
import { Setup2FASchema, Verify2FASchema, Disable2FASchema } from '@/lib/utils/validators';
import { upsertDevice, generateSessionId, storeSession } from '@/lib/auth/device';
import { parseIp, getUserAgent } from '@/lib/utils/response';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';

/** GET /api/auth/2fa — get current 2FA status */
export async function GET() {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const setup = await get2FASetup(session.uid);
  return ok({
    enabled: !!setup?.isVerified,
    method: setup?.method ?? null,
  });
}

/**
 * POST /api/auth/2fa
 *
 * action = 'setup'    → initiate 2FA setup (returns TOTP secret / sends email OTP)
 * action = 'confirm'  → confirm setup with first code
 * action = 'verify'   → verify code at login (uses preAuthToken, not full session)
 * action = 'disable'  → disable 2FA (requires password)
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const action: string = body?.action ?? '';

  // ── setup ────────────────────────────────────────────────────────────────────
  if (action === 'setup') {
    const session = await getSession();
    if (!session) return err('Unauthorized', 401);

    const parsed = Setup2FASchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const { method } = parsed.data;
    const userSnap = await adminDb.collection('users').doc(session.uid).get();
    const user = userSnap.data() as User;

    const { secret, backupCodes } = await enable2FA(session.uid, method);

    if (method === 'totp') {
      const uri = buildTotpUri(secret!, user.email, APP_NAME);
      return ok({ method, secret, uri, backupCodes });
    }

    // email_otp: send OTP
    const { generateEmailOtp, storeEmailOtp } = await import('@/lib/auth/twoFactor');
    const { send2FAOtpEmail } = await import('@/lib/mail/client');
    const otp = generateEmailOtp();
    await storeEmailOtp(session.uid, otp);
    await send2FAOtpEmail(user.email, otp, user.displayName);

    return ok({ method, backupCodes });
  }

  // ── confirm (after setup) ─────────────────────────────────────────────────────
  if (action === 'confirm') {
    const session = await getSession();
    if (!session) return err('Unauthorized', 401);

    const parsed = Verify2FASchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const setup = await get2FASetup(session.uid);
    if (!setup) return err('2FA setup not initiated', 400);

    const valid =
      setup.method === 'totp'
        ? verifyTotp(setup.secret, parsed.data.code)
        : await verifyEmailOtp(session.uid, parsed.data.code);

    if (!valid) return err('Invalid verification code', 400, 'INVALID_CODE');

    await confirm2FASetup(session.uid);
    return ok(null, '2FA enabled successfully.');
  }

  // ── verify (at login) ─────────────────────────────────────────────────────────
  if (action === 'verify') {
    const preAuthToken: string = body?.preAuthToken;
    if (!preAuthToken) return err('Missing pre-auth token', 400);

    const tokenPayload = await verifyOtpToken(preAuthToken, '2fa_pre_auth');
    if (!tokenPayload) return err('Invalid or expired session', 401);

    const parsed = Verify2FASchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const { uid } = tokenPayload;
    const setup = await get2FASetup(uid);
    if (!setup?.isVerified) return err('2FA not configured', 400);

    let valid = false;
    if (parsed.data.isBackupCode) {
      valid = await consumeBackupCode(uid, parsed.data.code);
    } else if (setup.method === 'totp') {
      valid = verifyTotp(setup.secret, parsed.data.code);
    } else {
      valid = await verifyEmailOtp(uid, parsed.data.code);
    }

    if (!valid) return err('Invalid verification code', 400, 'INVALID_CODE');

    // Issue full session
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.data() as User;

    const ip = parseIp(request);
    const userAgent = getUserAgent(request);
    const { deviceId } = await upsertDevice(uid, ip, userAgent);
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = await signSessionToken({ uid, email: user.email, roleId: user.roleId, sessionId, deviceId, pinSet: !!user.transactionPin });
    await storeSession(uid, sessionId, deviceId, expiresAt);
    await setSessionCookie(token);

    return ok(
      { uid, email: user.email, displayName: user.displayName, roleId: user.roleId },
      'Logged in successfully.'
    );
  }

  // ── disable ───────────────────────────────────────────────────────────────────
  if (action === 'disable') {
    const session = await getSession();
    if (!session) return err('Unauthorized', 401);

    const parsed = Disable2FASchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    // Verify password
    const { getAuth } = await import('firebase-admin/auth');
    const { default: fetch } = await import('node-fetch');
    const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';

    const userSnap = await adminDb.collection('users').doc(session.uid).get();
    const user = userSnap.data() as User;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: parsed.data.password, returnSecureToken: false }),
      }
    );

    if (!res.ok) return err('Incorrect password', 401);

    await disable2FA(session.uid);
    return ok(null, '2FA disabled.');
  }

  return err('Unknown action', 400);
}