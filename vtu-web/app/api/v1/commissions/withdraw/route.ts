// vtu-web/app/api/v1/commissions/withdraw/route.ts
// AGENTS.md RULES: #2 (wallet ops), #4 (zod), #5 (idempotency)

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requestCommissionWithdrawal } from '@/lib/commissions/engine';
import { ok, err } from '@/lib/utils/response';
import { adminDb } from '@/lib/firebase/admin';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const WithdrawSchema = z.object({
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
});

/**
 * POST /api/v1/commissions/withdraw
 *
 * Immediately credit all pending commissions to the user's wallet,
 * bypassing the auto-settlement threshold.
 *
 * Requires the transaction PIN to prevent accidental or unauthorized triggers.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = WithdrawSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { transactionPin } = parsed.data;

  // Load user and verify PIN
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  if (!user.transactionPin) {
    return err('Please set a transaction PIN before withdrawing commissions.', 400, 'NO_PIN');
  }

  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Trigger immediate settlement for this user only
  const result = await requestCommissionWithdrawal(session.uid);

  if (result.alreadyEmpty) {
    return err('You have no pending commissions to withdraw.', 400, 'NO_PENDING_COMMISSIONS');
  }

  return ok(
    {
      totalCreditedKobo: result.totalCredited,
      recordsSettled: result.recordsSettled,
    },
    `${result.recordsSettled} commission record${result.recordsSettled !== 1 ? 's' : ''} credited to your wallet.`
  );
}