// vtu-web/app/api/auth/set-pin/route.ts
// AGENTS.md RULES: #4 (Zod validation), #6 (server-side permission check)
// After setting PIN, reissues session cookie with pinSet: true so middleware
// stops redirecting the user on their very next navigation.

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getSession, signSessionToken, setSessionCookie } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const SetPinSchema = z.object({
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must contain only digits'),
});

// Trivially weak PINs blocked server-side
const BLOCKED_PINS = [
  '0000', '1111', '2222', '3333', '4444', '5555', '6666',
  '7777', '8888', '9999', '1234', '4321', '0123', '9876', '1212',
];

/** POST /api/auth/set-pin — create or update transaction PIN */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = SetPinSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { pin } = parsed.data;

  if (BLOCKED_PINS.includes(pin)) {
    return err('PIN is too common. Choose something less predictable.', 422, 'WEAK_PIN');
  }

  const hashed = await bcrypt.hash(pin, 12);

  await adminDb.collection('users').doc(session.uid).update({
    transactionPin: hashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Reissue session cookie with pinSet: true so middleware immediately unlocks services
  const updatedToken = await signSessionToken({
    uid: session.uid,
    email: session.email,
    roleId: session.roleId,
    sessionId: session.sessionId,
    deviceId: session.deviceId,
    pinSet: true,
  });
  await setSessionCookie(updatedToken);

  return ok(null, 'Transaction PIN set successfully.');
}

/** PUT /api/auth/set-pin — verify PIN (used by payment flows before debiting wallet) */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = SetPinSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { pin } = parsed.data;

  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);

  const { transactionPin } = userSnap.data() as { transactionPin: string | null };
  if (!transactionPin) {
    return err('No PIN set. Please set your transaction PIN first.', 400, 'NO_PIN_SET');
  }

  const valid = await bcrypt.compare(pin, transactionPin);
  if (!valid) return err('Incorrect PIN', 401, 'INVALID_PIN');

  return ok(null, 'PIN verified.');
}