import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { VerifyEmailSchema } from '@/lib/utils/validators';
import { ok, err } from '@/lib/utils/response';
import { verifyEmailOtp } from '@/lib/auth/twoFactor';
import { getSession } from '@/lib/auth/session';
import { sendWelcomeEmail } from '@/lib/mail/client';
import type { User } from '@/types';

export async function POST(request: NextRequest) {
  // Must be logged-in (pre-verification session allowed) or provide uid in body
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  // Accept uid from session or from body (for post-registration flow before login)
  const uid: string | undefined = session?.uid ?? body?.uid;
  if (!uid) return err('Unable to identify user', 400);

  const { otp } = parsed.data;
  const valid = await verifyEmailOtp(uid, otp);
  if (!valid) return err('Invalid or expired verification code', 400, 'INVALID_OTP');

  // Mark email as verified in Firebase Auth
  await getAuth().updateUser(uid, { emailVerified: true });

  // Update user doc
  await adminDb.collection('users').doc(uid).update({
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Send welcome email (non-blocking)
  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const user = userSnap.data() as User;
    sendWelcomeEmail(user.email, user.displayName).catch(console.error);
  }

  return ok(null, 'Email verified successfully.');
}

/** Resend verification OTP */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const uid: string | undefined = (await getSession())?.uid ?? body?.uid;
  if (!uid) return err('Unable to identify user', 400);

  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  const firebaseUser = await getAuth().getUser(uid);
  if (firebaseUser.emailVerified) return err('Email is already verified', 400);

  const { generateEmailOtp, storeEmailOtp } = await import('@/lib/auth/twoFactor');
  const { sendEmailVerification } = await import('@/lib/mail/client');

  const otp = generateEmailOtp();
  await storeEmailOtp(uid, otp);
  await sendEmailVerification(user.email, otp, user.displayName);

  return ok(null, 'Verification code resent.');
}