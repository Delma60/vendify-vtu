// vtu-web/app/api/v1/wallet/pin/route.ts
// AGENTS.md RULES: #4 (zod), #6 (permission checks server-side only)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { FieldValue } from 'firebase-admin/firestore';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const SetPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits'),
  confirmPin: z.string().length(4),
});

const ChangePinSchema = z.object({
  currentPin: z.string().length(4),
  newPin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits'),
  confirmNewPin: z.string().length(4),
});

/** POST /api/v1/wallet/pin — set transaction PIN (first time) */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = SetPinSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message, 422);

  const { pin, confirmPin } = parsed.data;
  if (pin !== confirmPin) return err('PINs do not match.', 400);

  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);

  const user = userSnap.data() as User;
  if (user.transactionPin) {
    return err('Transaction PIN is already set. Use PUT to change it.', 400);
  }

  const hashed = await bcrypt.hash(pin, 12);

  await adminDb.collection('users').doc(session.uid).update({
    transactionPin: hashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return ok(null, 'Transaction PIN set successfully.');
}

/** PUT /api/v1/wallet/pin — change transaction PIN */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = ChangePinSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message, 422);

  const { currentPin, newPin, confirmNewPin } = parsed.data;

  if (newPin !== confirmNewPin) return err('New PINs do not match.', 400);
  if (currentPin === newPin) return err('New PIN must differ from the current PIN.', 400);

  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);

  const user = userSnap.data() as User;
  if (!user.transactionPin) return err('No PIN set. Use POST to set one.', 400);

  const valid = await bcrypt.compare(currentPin, user.transactionPin);
  if (!valid) return err('Current PIN is incorrect.', 401, 'INVALID_PIN');

  const hashed = await bcrypt.hash(newPin, 12);

  await adminDb.collection('users').doc(session.uid).update({
    transactionPin: hashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Security alert email (non-blocking)
  import('@/lib/mail/client')
    .then(({ sendMail }) =>
      sendMail({
        to: user.email,
        subject: '⚠️ Your transaction PIN was changed',
        html: `<p>Hi ${user.displayName}, your transaction PIN was changed. If this wasn't you, contact support immediately.</p>`,
        text: `Your transaction PIN was changed. If this wasn't you, contact support immediately.`,
      })
    )
    .catch(console.error);

  return ok(null, 'Transaction PIN changed successfully.');
}