import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/admin';
import { ForgotPasswordSchema, ResetPasswordSchema } from '@/lib/utils/validators';
import { ok, err } from '@/lib/utils/response';
import { signOtpToken, verifyOtpToken } from '@/lib/auth/session';
import { sendPasswordResetEmail } from '@/lib/mail/client';
import { revokeAllSessions } from '@/lib/auth/device';
import type { User } from '@/types';

/** POST /api/auth/forgot-password — send reset link */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { email } = parsed.data;

  // Always return 200 to avoid email enumeration
  try {
    const firebaseUser = await getAuth().getUserByEmail(email);
    const uid = firebaseUser.uid;

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return ok(null, 'If an account exists, a reset link has been sent.');

    const user = userSnap.data() as User;
    const token = await signOtpToken({ uid, purpose: 'password_reset' });
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    await sendPasswordResetEmail(email, resetUrl, user.displayName);
  } catch {
    // Silently swallow — don't leak account existence
  }

  return ok(null, 'If an account exists, a reset link has been sent.');
}

/** PUT /api/auth/forgot-password — consume token + set new password */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { token, password } = parsed.data;
  const result = await verifyOtpToken(token, 'password_reset');
  if (!result) return err('Invalid or expired reset link', 400, 'INVALID_TOKEN');

  const { uid } = result;

  try {
    await getAuth().updateUser(uid, { password });
  } catch (e) {
    console.error('[reset-password]', e);
    return err('Failed to update password', 500);
  }

  // Revoke all existing sessions (security: log everyone out on password change)
  await revokeAllSessions(uid).catch(console.error);

  return ok(null, 'Password updated. Please log in again.');
}