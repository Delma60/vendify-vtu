// vtu-web/app/api/v1/subscription/purchase/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet } from '@/lib/wallet/operations';
import { getPlanById, assignPlanToUser, getUserSubscriptionStatus } from '@/lib/subscriptions/plans';
import { sendSubscriptionPurchasedEmail } from '@/lib/notifications/subcription';
import { generateReference } from '@/lib/utils/reference';
import { ok, err } from '@/lib/utils/response';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const PurchaseSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['monthly', 'annual']),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

/**
 * POST /api/v1/subscription/purchase
 * Purchase a subscription plan using wallet balance.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { planId, billingCycle, transactionPin, idempotencyKey } = parsed.data;

  // Load user
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  // Verify transaction PIN
  if (!user.transactionPin) {
    return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');
  }
  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Load plan
  const plan = await getPlanById(planId);
  if (!plan) return err('Subscription plan not found.', 404);
  if (!plan.isActive) return err('This plan is no longer available.', 400);

  // Prevent re-purchasing same plan (unless it's an upgrade/renewal)
  const currentStatus = await getUserSubscriptionStatus(session.uid);
  if (
    currentStatus.planId === planId &&
    !currentStatus.isExpired &&
    currentStatus.daysRemaining !== null &&
    currentStatus.daysRemaining > 7
  ) {
    return err(
      `You are already on the ${plan.name} plan with ${currentStatus.daysRemaining} days remaining. You can renew within 7 days of expiry.`,
      400,
      'ALREADY_SUBSCRIBED'
    );
  }

  // Determine amount
  const amountKobo =
    billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  if (amountKobo === 0) {
    // Free plan — just assign directly (no payment needed)
    await assignPlanToUser(session.uid, planId, billingCycle, session.uid);
    return ok({ planId, billingCycle, amountCharged: 0 }, 'Plan activated.');
  }

  const reference = generateReference('subscription');
  const expiresAt = new Date(
    Date.now() + (billingCycle === 'annual' ? 365 : 30) * 86400000
  );

  // Debit wallet
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      amountKobo,
      {
        category: 'fee',
        status: 'success',
        reference,
        provider: null,
        metadata: {
          type: 'subscription_purchase',
          planId,
          planName: plan.name,
          billingCycle,
          expiresAt: expiresAt.toISOString(),
        },
      },
      idempotencyKey
    );
  } catch (error) {
    const e = error as { code?: string; message: string };
    if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate purchase request.', 409, e.code);
    if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance.', 400, e.code);
    if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Contact support.', 403, e.code);
    throw error;
  }

  // Assign plan
  await assignPlanToUser(session.uid, planId, billingCycle, session.uid);

  // Send confirmation email (non-blocking)
  sendSubscriptionPurchasedEmail({
    to: user.email,
    displayName: user.displayName,
    planName: plan.name,
    billingCycle,
    amountKobo,
    expiresAt,
  }).catch(console.error);

  return ok(
    {
      txnId,
      reference,
      planId,
      planName: plan.name,
      billingCycle,
      amountCharged: amountKobo,
      expiresAt: expiresAt.toISOString(),
    },
    `Successfully subscribed to ${plan.name}.`
  );
}