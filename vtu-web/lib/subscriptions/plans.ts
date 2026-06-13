// vtu-web/lib/subscriptions/plans.ts
// AGENTS.md RULES: #1 (kobo), #8 (never hard-delete), #13 (config from Firestore), #14 (runtime config)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { SubscriptionPlan, User } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSubscriptionStatus {
  planId: string;
  planName: string;
  isActive: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  features: SubscriptionPlan['features'];
  gracePeriodActive: boolean;
}

export interface PlanCreateInput {
  name: string;
  description: string;
  monthlyPrice: number;   // in kobo
  annualPrice: number;    // in kobo
  features: SubscriptionPlan['features'];
  displayOrder?: number;
}

export interface PlanUpdateInput extends Partial<PlanCreateInput> {
  isActive?: boolean;
}

export interface ProrateResult {
  creditKobo: number;    // unused value from old plan
  chargeKobo: number;    // cost of new plan (full billing period)
  netChargeKobo: number; // chargeKobo - creditKobo (capped at 0)
  daysUsed: number;
  daysRemaining: number;
}

// Grace period after expiry before downgrading to free (in days)
const GRACE_PERIOD_DAYS = 3;

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Return all active subscription plans ordered by displayOrder.
 */
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const snap = await adminDb
    .collection('subscription_plans')
    .where('isActive', '==', true)
    .orderBy('displayOrder', 'asc')
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
}

/**
 * Return all plans (active + inactive) for admin management.
 */
export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  const snap = await adminDb
    .collection('subscription_plans')
    .orderBy('displayOrder', 'asc')
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
}

/**
 * Return a single plan by ID, or null if not found.
 */
export async function getPlanById(planId: string): Promise<SubscriptionPlan | null> {
  const snap = await adminDb.collection('subscription_plans').doc(planId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as SubscriptionPlan;
}

// ─── USER SUBSCRIPTION STATUS ─────────────────────────────────────────────────

/**
 * Determine the effective subscription status for a user, including grace period logic.
 * Falls back to the free plan if the plan doc is missing.
 */
export async function getUserSubscriptionStatus(userId: string): Promise<UserSubscriptionStatus> {
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');

  const user = userSnap.data() as User;
  const planSnap = await adminDb
    .collection('subscription_plans')
    .doc(user.subscriptionPlanId)
    .get();

  // If plan not found, treat as free
  const freePlanFeatures: SubscriptionPlan['features'] = {
    apiAccess: false,
    bucketAccess: false,
    loanAccess: false,
    whitelabelAccess: false,
    maxDailyTransactions: 10,
    rateDiscount: 0,
    prioritySupport: false,
    maxApiKeys: 0,
  };

  const plan = planSnap.exists
    ? ({ id: planSnap.id, ...planSnap.data() } as SubscriptionPlan)
    : null;

  const expiresAt = user.subscriptionExpiresAt?.toDate() ?? null;
  const now = new Date();

  // A plan with null expiresAt is treated as lifetime/never-expiring (e.g. free plan)
  const isExpired = expiresAt !== null && expiresAt < now;
  const graceCutoff = expiresAt
    ? new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const gracePeriodActive = isExpired && graceCutoff !== null && now < graceCutoff;

  const isActive = !isExpired || gracePeriodActive;

  const daysRemaining =
    expiresAt && !isExpired
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  return {
    planId: user.subscriptionPlanId,
    planName: plan?.name ?? 'Free',
    isActive,
    isExpired,
    expiresAt,
    daysRemaining,
    features: plan?.features ?? freePlanFeatures,
    gracePeriodActive,
  };
}

/**
 * Enforce feature gating — throws if the user's active plan doesn't allow the feature.
 * Call this inside API routes before performing feature-gated operations.
 *
 * @example
 *   await enforceFeatureAccess(userId, 'apiAccess');
 */
export async function enforceFeatureAccess(
  userId: string,
  feature: keyof SubscriptionPlan['features']
): Promise<void> {
  const status = await getUserSubscriptionStatus(userId);

  if (!status.isActive) {
    throw Object.assign(new Error('Subscription has expired. Please renew to continue.'), {
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }

  const value = status.features[feature];
  if (typeof value === 'boolean' && !value) {
    throw Object.assign(
      new Error(`Your current plan does not include access to this feature. Upgrade to unlock it.`),
      { code: 'FEATURE_NOT_AVAILABLE' }
    );
  }
}

/**
 * Enforce max daily transaction limit from the user's plan.
 * Returns silently if within limits, throws if exceeded.
 */
export async function enforceTransactionLimit(userId: string, dailyCount: number): Promise<void> {
  const status = await getUserSubscriptionStatus(userId);
  const limit = status.features.maxDailyTransactions;
  if (limit !== null && dailyCount >= limit) {
    throw Object.assign(
      new Error(`You have reached your plan's daily transaction limit of ${limit}. Upgrade for more.`),
      { code: 'TRANSACTION_LIMIT_EXCEEDED' }
    );
  }
}

// ─── PRORATE CALCULATION ──────────────────────────────────────────────────────

/**
 * Calculate prorated credit from an existing active plan when upgrading mid-cycle.
 * Returns a ProrateResult that the purchase flow uses to reduce the charge.
 */
export function calculateProrate(
  currentMonthlyPriceKobo: number,
  expiresAt: Date
): ProrateResult {
  const now = new Date();
  const totalMs = 30 * 24 * 60 * 60 * 1000; // 30-day billing cycle
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  const usedMs = totalMs - remainingMs;

  const daysUsed = Math.floor(usedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  const dailyRateKobo = currentMonthlyPriceKobo / 30;
  const creditKobo = Math.floor(dailyRateKobo * daysRemaining);

  return {
    creditKobo,
    chargeKobo: 0, // populated by the purchase flow
    netChargeKobo: 0,
    daysUsed,
    daysRemaining,
  };
}

// ─── ADMIN CREATE / UPDATE / DELETE ───────────────────────────────────────────

/**
 * Create a new subscription plan.
 * Returns the new plan document ID.
 */
export async function createPlan(input: PlanCreateInput, adminId: string): Promise<string> {
  // Determine next displayOrder if not provided
  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const last = await adminDb
      .collection('subscription_plans')
      .orderBy('displayOrder', 'desc')
      .limit(1)
      .get();
    displayOrder = last.empty ? 1 : (last.docs[0].data().displayOrder as number) + 1;
  }

  const ref = adminDb.collection('subscription_plans').doc();
  await ref.set({
    name: input.name,
    description: input.description,
    monthlyPrice: input.monthlyPrice,
    annualPrice: input.annualPrice,
    features: input.features,
    isActive: true,
    displayOrder,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(adminId, 'subscription_plan:create', ref.id, null, input);
  return ref.id;
}

/**
 * Update fields on an existing plan.
 * Cannot update a plan that has been soft-deleted (isActive:false is allowed via togglePlan).
 */
export async function updatePlan(
  planId: string,
  updates: PlanUpdateInput,
  adminId: string
): Promise<void> {
  const snap = await adminDb.collection('subscription_plans').doc(planId).get();
  if (!snap.exists) throw new Error('Plan not found');

  const before = snap.data();
  await adminDb.collection('subscription_plans').doc(planId).update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(adminId, 'subscription_plan:update', planId, before, updates);
}

/**
 * Soft-deactivate a plan (isActive = false).
 * Existing subscribers keep their plan until expiry; no new purchases allowed.
 */
export async function deactivatePlan(planId: string, adminId: string): Promise<void> {
  const snap = await adminDb.collection('subscription_plans').doc(planId).get();
  if (!snap.exists) throw new Error('Plan not found');

  const plan = snap.data() as SubscriptionPlan;
  if (plan.name.toLowerCase() === 'free') {
    throw new Error('The free plan cannot be deactivated.');
  }

  await adminDb.collection('subscription_plans').doc(planId).update({
    isActive: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(adminId, 'subscription_plan:deactivate', planId, { isActive: true }, { isActive: false });
}

/**
 * Reactivate a previously deactivated plan.
 */
export async function reactivatePlan(planId: string, adminId: string): Promise<void> {
  const snap = await adminDb.collection('subscription_plans').doc(planId).get();
  if (!snap.exists) throw new Error('Plan not found');

  await adminDb.collection('subscription_plans').doc(planId).update({
    isActive: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(adminId, 'subscription_plan:reactivate', planId, { isActive: false }, { isActive: true });
}

// ─── ADMIN USER OVERRIDE ──────────────────────────────────────────────────────

/**
 * Manually assign or override a subscription plan for a specific user.
 * Used by admins to gift plans, fix billing issues, etc.
 */
export async function adminAssignPlan(
  targetUserId: string,
  planId: string,
  billingCycle: 'monthly' | 'annual' | 'lifetime',
  adminId: string
): Promise<void> {
  const [userSnap, planSnap] = await Promise.all([
    adminDb.collection('users').doc(targetUserId).get(),
    adminDb.collection('subscription_plans').doc(planId).get(),
  ]);

  if (!userSnap.exists) throw new Error('User not found');
  if (!planSnap.exists) throw new Error('Plan not found');

  const user = userSnap.data() as User;
  const before = { subscriptionPlanId: user.subscriptionPlanId, subscriptionExpiresAt: user.subscriptionExpiresAt };

  let expiresAt: Timestamp | null = null;
  if (billingCycle !== 'lifetime') {
    const days = billingCycle === 'monthly' ? 30 : 365;
    expiresAt = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  }

  await adminDb.collection('users').doc(targetUserId).update({
    subscriptionPlanId: planId,
    subscriptionExpiresAt: expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(adminId, 'subscription:admin_assign', targetUserId, before, {
    planId,
    billingCycle,
    expiresAt,
  });
}

/**
 * Assign a subscription plan for a user as part of a purchase or upgrade flow.
 * This is the non-admin helper used by self-service subscription endpoints.
 */
export async function assignPlanToUser(
  targetUserId: string,
  planId: string,
  billingCycle: 'monthly' | 'annual' | 'lifetime',
  actingUserId: string
): Promise<void> {
  const [userSnap, planSnap] = await Promise.all([
    adminDb.collection('users').doc(targetUserId).get(),
    adminDb.collection('subscription_plans').doc(planId).get(),
  ]);

  if (!userSnap.exists) throw new Error('User not found');
  if (!planSnap.exists) throw new Error('Plan not found');

  const user = userSnap.data() as User;
  const before = { subscriptionPlanId: user.subscriptionPlanId, subscriptionExpiresAt: user.subscriptionExpiresAt };

  let expiresAt: Timestamp | null = null;
  if (billingCycle !== 'lifetime') {
    const days = billingCycle === 'monthly' ? 30 : 365;
    expiresAt = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  }

  await adminDb.collection('users').doc(targetUserId).update({
    subscriptionPlanId: planId,
    subscriptionExpiresAt: expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog(actingUserId, 'subscription:assign', targetUserId, before, {
    planId,
    billingCycle,
    expiresAt,
  });
}

// ─── DOWNGRADE EXPIRED USERS (cron helper) ───────────────────────────────────

/**
 * Called by the subscription renewal cron job.
 * Finds users whose subscription + grace period has fully expired and
 * reverts them to the free plan.
 *
 * Returns number of users downgraded.
 */
export async function downgradeExpiredUsers(): Promise<{ downgraded: number }> {
  const graceCutoff = Timestamp.fromDate(
    new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  );

  // Users whose subscription expired more than GRACE_PERIOD_DAYS ago
  // and are not on the free plan
  const snap = await adminDb
    .collection('users')
    .where('subscriptionExpiresAt', '<', graceCutoff)
    .where('subscriptionPlanId', '!=', 'free')
    .get();

  if (snap.empty) return { downgraded: 0 };

  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      subscriptionPlanId: 'free',
      subscriptionExpiresAt: null,
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
  return { downgraded: snap.size };
}

// ─── RENEWAL REMINDER CANDIDATES ─────────────────────────────────────────────

/**
 * Returns users whose subscription expires within `daysUntilExpiry` days.
 * Used by the subscription renewal reminder cron job.
 */
export async function getRenewalReminderCandidates(
  daysUntilExpiry: 1 | 3 | 7
): Promise<Array<{ userId: string; email: string; displayName: string; planName: string; expiresAt: Date }>> {
  const now = new Date();
  const from = Timestamp.fromDate(now);
  const to = Timestamp.fromDate(new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000));

  const snap = await adminDb
    .collection('users')
    .where('subscriptionExpiresAt', '>=', from)
    .where('subscriptionExpiresAt', '<=', to)
    .where('subscriptionPlanId', '!=', 'free')
    .get();

  const planCache = new Map<string, string>();

  const results = await Promise.all(
    snap.docs.map(async doc => {
      const user = doc.data() as User;

      if (!planCache.has(user.subscriptionPlanId)) {
        const planSnap = await adminDb.collection('subscription_plans').doc(user.subscriptionPlanId).get();
        planCache.set(user.subscriptionPlanId, planSnap.data()?.name ?? 'Unknown');
      }

      return {
        userId: doc.id,
        email: user.email,
        displayName: user.displayName,
        planName: planCache.get(user.subscriptionPlanId)!,
        expiresAt: user.subscriptionExpiresAt!.toDate(),
      };
    })
  );

  return results;
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function writeAuditLog(
  adminId: string,
  action: string,
  targetId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  try {
    await adminDb.collection('audit_logs').add({
      adminId,
      action,
      resource: 'subscription_plan',
      targetId,
      before,
      after,
      ip: 'server',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[subscription audit]', e);
  }
}