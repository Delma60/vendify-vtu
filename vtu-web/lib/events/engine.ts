// vtu-web/lib/campaign-events/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops through lib/wallet/operations.ts only),
//                  #8 (never hard-delete — archive only), #9 (log), #13 (config from Firestore)
//
// Generic, admin-defined "campaign events": an admin creates an event with a
// shareable link. Anyone who opens the link and is logged in (or signs up
// through it) can claim the configured reward(s) — wallet credit, loyalty
// points, and/or a badge — subject to segment, date, and budget rules.
// Conceptually mirrors lib/cashback/engine.ts and lib/commissions/engine.ts.

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import type {
  CampaignEventDefinition,
  CampaignEventReward,
  CampaignEventSegment,
  CampaignEventClaim,
} from '@/types/campaign-events';
import type { User } from '@/types';

// ─── Slug / key generation ─────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

async function generateUniqueShareSlug(name: string): Promise<string> {
  const base = slugify(name) || 'event';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    const existing = await adminDb
      .collection('campaign_events')
      .where('shareSlug', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  return `${base}-${crypto.randomBytes(4).toString('hex')}`; // fallback — fully random
}

function generateEventKey(name: string): string {
  return `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
}

// ─── Validation helpers ────────────────────────────────────────────────────────

function validateRewards(rewards: CampaignEventReward[]): void {
  if (!rewards.length) throw new Error('At least one reward is required');

  for (const r of rewards) {
    if (r.type === 'wallet_credit') {
      if (!r.walletCreditKobo || r.walletCreditKobo <= 0 || !Number.isInteger(r.walletCreditKobo)) {
        throw new Error('walletCreditKobo must be a positive integer (kobo)');
      }
    } else if (r.type === 'loyalty_points') {
      if (!r.loyaltyPoints || r.loyaltyPoints <= 0 || !Number.isInteger(r.loyaltyPoints)) {
        throw new Error('loyaltyPoints must be a positive integer');
      }
    } else if (r.type === 'badge') {
      if (!r.badgeId) throw new Error('badgeId is required for badge rewards');
    } else {
      throw new Error(`Unknown reward type: ${(r as { type: string }).type}`);
    }
  }
}

function walletRewardTotalKobo(rewards: CampaignEventReward[]): number {
  return rewards
    .filter(r => r.type === 'wallet_credit')
    .reduce((sum, r) => sum + (r.walletCreditKobo ?? 0), 0);
}

// ─── CRUD (admin) ──────────────────────────────────────────────────────────────

export interface CreateCampaignEventInput {
  name: string;
  description: string;
  rewards: CampaignEventReward[];
  userSegment: CampaignEventSegment;
  maxClaimsPerUser: number;
  maxTotalClaims: number;
  totalBudgetKobo: number;
  startDate: Date;
  endDate: Date;
}

export async function createCampaignEvent(
  input: CreateCampaignEventInput,
  adminId: string
): Promise<CampaignEventDefinition> {
  validateRewards(input.rewards);

  if (input.endDate <= input.startDate) {
    throw new Error('endDate must be after startDate');
  }

  const shareSlug = await generateUniqueShareSlug(input.name);
  const eventKey = generateEventKey(input.name);
  const now = Timestamp.now();

  const ref = adminDb.collection('campaign_events').doc();
  const doc: Omit<CampaignEventDefinition, 'id'> = {
    name: input.name,
    description: input.description,
    eventKey,
    shareSlug,
    rewards: input.rewards,
    userSegment: input.userSegment,
    maxClaimsPerUser: input.maxClaimsPerUser,
    maxTotalClaims: input.maxTotalClaims,
    totalBudgetKobo: input.totalBudgetKobo,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    isActive: true,
    isArchived: false,
    totalClaimedCount: 0,
    totalPaidKobo: 0,
    totalPointsAwarded: 0,
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export interface UpdateCampaignEventInput {
  name?: string;
  description?: string;
  rewards?: CampaignEventReward[];
  userSegment?: CampaignEventSegment;
  maxClaimsPerUser?: number;
  maxTotalClaims?: number;
  totalBudgetKobo?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export async function updateCampaignEvent(
  id: string,
  patch: UpdateCampaignEventInput
): Promise<void> {
  if (patch.rewards) validateRewards(patch.rewards);

  const updates: Record<string, unknown> = { ...patch, updatedAt: Timestamp.now() };
  if (patch.startDate) updates.startDate = Timestamp.fromDate(patch.startDate);
  if (patch.endDate) updates.endDate = Timestamp.fromDate(patch.endDate);

  await adminDb.collection('campaign_events').doc(id).update(updates);
}

/** Soft-archive only — AGENTS.md rule #8. Never hard-delete. */
export async function archiveCampaignEvent(id: string): Promise<void> {
  await adminDb.collection('campaign_events').doc(id).update({
    isArchived: true,
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}

export async function getCampaignEvent(id: string): Promise<CampaignEventDefinition | null> {
  const snap = await adminDb.collection('campaign_events').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CampaignEventDefinition;
}

export async function getCampaignEventBySlug(slug: string): Promise<CampaignEventDefinition | null> {
  const snap = await adminDb
    .collection('campaign_events')
    .where('shareSlug', '==', slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as CampaignEventDefinition;
}

export async function listCampaignEvents(opts: {
  includeArchived?: boolean;
  activeOnly?: boolean;
} = {}): Promise<CampaignEventDefinition[]> {
  let query = adminDb.collection('campaign_events').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;
  if (!opts.includeArchived) query = query.where('isArchived', '==', false);
  if (opts.activeOnly) query = query.where('isActive', '==', true);

  const snap = await query.limit(200).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CampaignEventDefinition);
}

// ─── Segment matching ──────────────────────────────────────────────────────────

function userMatchesSegment(
  user: User,
  segment: CampaignEventSegment,
  campaignStartDate: Timestamp
): boolean {
  if (segment === 'all') return true;

  if (segment === 'new_users') {
    const createdAt =
      user.createdAt instanceof Timestamp
        ? user.createdAt.toMillis()
        : new Date(user.createdAt as unknown as string).getTime();
    return createdAt >= campaignStartDate.toMillis();
  }

  if (segment === 'kyc_tier_1') return (user.kycTier ?? 0) >= 1;
  if (segment === 'kyc_tier_2') return (user.kycTier ?? 0) >= 2;
  if (segment === 'plan_starter') return user.subscriptionPlanId === 'starter';
  if (segment === 'plan_pro') return user.subscriptionPlanId === 'pro';
  if (segment === 'plan_enterprise') return user.subscriptionPlanId === 'enterprise';

  return false;
}

// ─── CLAIM (the core trigger) ──────────────────────────────────────────────────

export interface ClaimResult {
  alreadyClaimed: boolean;
  claimed: boolean;
  reason?: string;
  rewardsGiven: CampaignEventReward[];
}

/**
 * Claim a campaign event's reward for a user. Idempotent up to maxClaimsPerUser.
 * Called from the public /e/{slug} landing flow, or directly by eventKey from
 * anywhere else in the app (e.g. after a milestone action completes).
 */
export async function claimCampaignEvent(
  identifier: { eventDefId?: string; eventKey?: string; shareSlug?: string },
  userId: string,
  opts: { source?: CampaignEventClaim['source']; ip?: string | null } = {}
): Promise<ClaimResult> {
  // 1. Resolve the event definition
  let event: CampaignEventDefinition | null = null;

  if (identifier.eventDefId) {
    event = await getCampaignEvent(identifier.eventDefId);
  } else if (identifier.shareSlug) {
    event = await getCampaignEventBySlug(identifier.shareSlug);
  } else if (identifier.eventKey) {
    const snap = await adminDb
      .collection('campaign_events')
      .where('eventKey', '==', identifier.eventKey)
      .limit(1)
      .get();
    if (!snap.empty) event = { id: snap.docs[0].id, ...snap.docs[0].data() } as CampaignEventDefinition;
  }

  if (!event) return { alreadyClaimed: false, claimed: false, reason: 'Event not found', rewardsGiven: [] };
  if (event.isArchived || !event.isActive) {
    return { alreadyClaimed: false, claimed: false, reason: 'Event is no longer active', rewardsGiven: [] };
  }

  const now = Timestamp.now();
  if (now.toMillis() < event.startDate.toMillis() || now.toMillis() > event.endDate.toMillis()) {
    return { alreadyClaimed: false, claimed: false, reason: 'Event is outside its active window', rewardsGiven: [] };
  }

  // 2. Load user, check segment
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return { alreadyClaimed: false, claimed: false, reason: 'User not found', rewardsGiven: [] };
  const user = userSnap.data() as User;

  if (!userMatchesSegment(user, event.userSegment, event.startDate)) {
    return { alreadyClaimed: false, claimed: false, reason: 'You are not eligible for this event', rewardsGiven: [] };
  }

  // 3. Per-user cap
  if (event.maxClaimsPerUser > 0) {
    const priorClaimsSnap = await adminDb
      .collection('campaign_event_claims')
      .where('eventDefId', '==', event.id)
      .where('userId', '==', userId)
      .get();

    if (priorClaimsSnap.size >= event.maxClaimsPerUser) {
      return { alreadyClaimed: true, claimed: false, reason: 'Already claimed', rewardsGiven: [] };
    }
  }

  // 4. Total claims cap
  if (event.maxTotalClaims > 0 && event.totalClaimedCount >= event.maxTotalClaims) {
    return { alreadyClaimed: false, claimed: false, reason: 'This event has reached its claim limit', rewardsGiven: [] };
  }

  // 5. Budget cap (wallet_credit rewards only)
  const walletRewardKobo = walletRewardTotalKobo(event.rewards);
  if (walletRewardKobo > 0 && event.totalBudgetKobo > 0) {
    if (event.totalPaidKobo + walletRewardKobo > event.totalBudgetKobo) {
      return { alreadyClaimed: false, claimed: false, reason: 'Event budget has been exhausted', rewardsGiven: [] };
    }
  }

  // 6. Write the claim record FIRST — guards re-entrancy/double submits.
  const claimRef = adminDb.collection('campaign_event_claims').doc();
  await claimRef.set({
    eventDefId: event.id,
    eventKey: event.eventKey,
    userId,
    rewardsGiven: event.rewards,
    source: opts.source ?? 'link',
    ip: opts.ip ?? null,
    createdAt: FieldValue.serverTimestamp(),
  } satisfies Omit<CampaignEventClaim, 'id' | 'createdAt'> & { createdAt: unknown });

  // 7. Bump counters atomically
  const pointsAwarded = event.rewards
    .filter(r => r.type === 'loyalty_points')
    .reduce((sum, r) => sum + (r.loyaltyPoints ?? 0), 0);

  await adminDb.collection('campaign_events').doc(event.id).update({
    totalClaimedCount: FieldValue.increment(1),
    totalPaidKobo: FieldValue.increment(walletRewardKobo),
    totalPointsAwarded: FieldValue.increment(pointsAwarded),
    updatedAt: Timestamp.now(),
  });

  // 8. Dispatch each reward
  for (const reward of event.rewards) {
    try {
      if (reward.type === 'wallet_credit' && reward.walletCreditKobo) {
        await creditWallet(userId, reward.walletCreditKobo, {
          category: 'campaign_reward',
          status: 'success',
          reference: generateReference('campaign_reward'),
          metadata: { eventDefId: event.id, eventKey: event.eventKey, eventName: event.name, claimId: claimRef.id },
        });
      } else if (reward.type === 'loyalty_points' && reward.loyaltyPoints) {
        await awardLoyaltyPoints(userId, reward.loyaltyPoints, event.id);
      } else if (reward.type === 'badge' && reward.badgeId) {
        await awardBadge(userId, reward.badgeId, reward.badgeLabel ?? reward.badgeId, event.id);
      }
    } catch (error) {
      console.error('[campaign-events:dispatch-reward]', event.id, userId, reward.type, error);
    }
  }

  notifyCampaignRewardClaimed(userId, event).catch(console.error);

  return { alreadyClaimed: false, claimed: true, rewardsGiven: event.rewards };
}

// ─── Loyalty points ─────────────────────────────────────────────────────────────

async function awardLoyaltyPoints(userId: string, points: number, eventDefId: string): Promise<void> {
  const balanceRef = adminDb.collection('loyalty_points_balances').doc(userId);

  await adminDb.runTransaction(async (txn) => {
    const balanceSnap = await txn.get(balanceRef);
    const currentBalance = balanceSnap.exists ? (balanceSnap.data()?.balance as number) ?? 0 : 0;
    const newBalance = currentBalance + points;

    txn.set(balanceRef, { userId, balance: newBalance, updatedAt: Timestamp.now() }, { merge: true });

    const ledgerRef = adminDb.collection('loyalty_points_ledger').doc();
    txn.set(ledgerRef, {
      userId,
      amount: points,
      balanceAfter: newBalance,
      source: 'campaign_event',
      eventDefId,
      createdAt: Timestamp.now(),
    });
  });
}

export async function getLoyaltyPointsBalance(userId: string): Promise<number> {
  const snap = await adminDb.collection('loyalty_points_balances').doc(userId).get();
  return snap.exists ? ((snap.data()?.balance as number) ?? 0) : 0;
}

// ─── Badges ─────────────────────────────────────────────────────────────────────

async function awardBadge(userId: string, badgeId: string, badgeLabel: string, eventDefId: string): Promise<void> {
  // Deterministic ID — one badge per event per user, idempotent
  const ref = adminDb.collection('user_badges').doc(`${userId}_${eventDefId}`);
  await ref.set({ userId, badgeId, badgeLabel, eventDefId, awardedAt: Timestamp.now() });
}

export async function getUserBadges(userId: string) {
  const snap = await adminDb.collection('user_badges').where('userId', '==', userId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Analytics (admin) ──────────────────────────────────────────────────────────

export interface CampaignEventAnalytics {
  eventDefId: string;
  name: string;
  totalClaimedCount: number;
  totalPaidKobo: number;
  totalPointsAwarded: number;
  totalBudgetKobo: number;
  budgetUtilisationPct: number;
  remainingBudgetKobo: number;
}

export async function getCampaignEventAnalytics(id: string): Promise<CampaignEventAnalytics> {
  const event = await getCampaignEvent(id);
  if (!event) throw new Error(`Campaign event ${id} not found`);

  const budgetUtilisationPct =
    event.totalBudgetKobo > 0
      ? Math.min(100, Math.round((event.totalPaidKobo / event.totalBudgetKobo) * 100))
      : 0;

  const remainingBudgetKobo =
    event.totalBudgetKobo > 0 ? Math.max(0, event.totalBudgetKobo - event.totalPaidKobo) : 0;

  return {
    eventDefId: event.id,
    name: event.name,
    totalClaimedCount: event.totalClaimedCount,
    totalPaidKobo: event.totalPaidKobo,
    totalPointsAwarded: event.totalPointsAwarded,
    totalBudgetKobo: event.totalBudgetKobo,
    budgetUtilisationPct,
    remainingBudgetKobo,
  };
}

// ─── Notification ───────────────────────────────────────────────────────────────

async function notifyCampaignRewardClaimed(userId: string, event: CampaignEventDefinition): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return;
  const user = userSnap.data() as User & { notifications: { email: boolean } };
  if (!user.notifications?.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const rewardLines = event.rewards.map(r => {
    if (r.type === 'wallet_credit') return `${koboToNaira(r.walletCreditKobo ?? 0)} wallet credit`;
    if (r.type === 'loyalty_points') return `${r.loyaltyPoints} loyalty points`;
    return `the "${r.badgeLabel ?? r.badgeId}" badge`;
  }).join(', ');

  await sendMail({
    to: user.email,
    subject: `You claimed a reward from "${event.name}" 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Reward claimed!</h2>
        <p>Hi ${user.displayName}, you just claimed ${rewardLines} from <strong>${event.name}</strong>.</p>
        <a href="${appUrl}/dashboard/wallet" style="display:inline-block;padding:12px 24px;background:#22C55E;color:#fff;text-decoration:none;border-radius:6px">View wallet</a>
      </div>
    `,
    text: `You claimed ${rewardLines} from ${event.name}.`,
  });
}