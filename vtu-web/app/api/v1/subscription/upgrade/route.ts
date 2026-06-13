// vtu-web/app/api/v1/subscription/upgrade/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet } from '@/lib/wallet/operations';
import {
  getPlanById,
  getUserSubscriptionStatus,
  assignPlanToUser,
  calculateProrate,
} from '@/lib/subscriptions/plans';
import { sendSubscriptionPurchasedEmail } from '@/lib//notifications/subcription';
import { generateReference } from '@/lib/utils/reference';
import { ok, err } from '@/lib/utils/response';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const UpgradeSchema = z.object({
  newPlanId: z.string().min(1, 'New plan ID is required'),
  billingCycle: z.enum(['monthly', 'annual']),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

/**
 * POST /api/v1/subscription/upgrade
 * Mid-cycle plan upgrade with prorate credit for unused days on the current plan.
 * Only allows upgrades (higher-priced plans). For downgrades, user must wait for renewal.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = UpgradeSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { newPlanId, billingCycle, transactionPin, idempotencyKey } = parsed.data;

  // Load user
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  // Verify transaction PIN
  if (!user.transactionPin) return err('Please set a transaction PIN first.', 400, 'NO_PIN');
  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Load plans
  const [newPlan, currentStatus] = await Promise.all([
    getPlanById(newPlanId),
    getUserSubscriptionStatus(session.uid),
  ]);

  if (!newPlan) return err('Plan not found.', 404);
  if (!newPlan.isActive) return err('This plan is no longer available.', 400);
  if (newPlanId === currentStatus.planId) return err('You are already on this plan.', 400);

  const currentPlan = await getPlanById(currentStatus.planId);

  // Only allow upgrade to a more expensive plan
  const currentMonthlyPrice = currentPlan?.monthlyPrice ?? 0;
  const newMonthlyPrice = newPlan.monthlyPrice;

  if (newMonthlyPrice <= currentMonthlyPrice) {
    return err(
      'Plan downgrades are not supported mid-cycle. Your new plan will take effect at renewal.',
      400,
      'DOWNGRADE_NOT_ALLOWED'
    );
  }

  // Calculate prorate
  const billingCycleDays = billingCycle === 'annual' ? 365 : 30;
  let daysUsed = 0;

  if (currentStatus.expiresAt) {
    const totalDays = billingCycleDays;
    const daysRemaining = Math.max(
      0,
      Math.ceil((currentStatus.expiresAt.getTime() - Date.now()) / 86400000)
    );
    daysUsed = totalDays - daysRemaining;
  }

  const prorate = calculateProrate(
    currentMonthlyPrice,
    newMonthlyPrice,
    billingCycleDays,
    daysUsed
  );

  const newPlanPrice =
    billingCycle === 'annual' ? newPlan.annualPrice : newPlan.monthlyPrice;

  // Net charge is prorate-adjusted; minimum is 0
  const netChargeKobo = prorate.netChargeKobo;
  const reference = generateReference('subscription');
  const expiresAt = new Date(Date.now() + billingCycleDays * 86400000);

  // Debit wallet (only if there's something to charge)
  let txnId: string | null = null;
  if (netChargeKobo > 0) {
    try {
      txnId = await debitWallet(
        session.uid,
        netChargeKobo,
        {
          category: 'fee',
          status: 'success',
          reference,
          provider: null,
          metadata: {
            type: 'subscription_upgrade',
            fromPlanId: currentStatus.planId,
            toPlanId: newPlanId,
            planName: newPlan.name,
            billingCycle,
            prorate,
            fullPrice: newPlanPrice,
            expiresAt: expiresAt.toISOString(),
          },
        },
        idempotencyKey
      );
    } catch (error) {
      const e = error as { code?: string; message: string };
      if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate upgrade request.', 409, e.code);
      if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance.', 400, e.code);
      if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Contact support.', 403, e.code);
      throw error;
    }
  }

  // Assign new plan
  await assignPlanToUser(session.uid, newPlanId, billingCycle, session.uid);

  // Send confirmation email (non-blocking)
  sendSubscriptionPurchasedEmail({
    to: user.email,
    displayName: user.displayName,
    planName: newPlan.name,
    billingCycle,
    amountKobo: netChargeKobo,
    expiresAt,
  }).catch(console.error);

  return ok(
    {
      txnId,
      reference,
      newPlanId,
      newPlanName: newPlan.name,
      billingCycle,
      prorate,
      netChargeKobo,
      expiresAt: expiresAt.toISOString(),
    },
    `Upgraded to ${newPlan.name} successfully.`
  );
}