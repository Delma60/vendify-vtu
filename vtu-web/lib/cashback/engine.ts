// vtu-web/lib/cashback/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod validation at boundaries),
//                  #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import type { Transaction, User } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which users are eligible for this campaign */
export type UserSegment =
  | 'all'
  | 'kyc_tier_1'       // basic KYC
  | 'kyc_tier_2'       // enhanced KYC
  | 'plan_starter'
  | 'plan_pro'
  | 'plan_enterprise'
  | 'new_users';       // registered within last 30 days

export type CashbackType = 'percentage' | 'flat';

/** Defines whether this campaign's cashback stacks with active coupon discounts */
export type StackingRule = 'stackable' | 'exclusive';

export interface CashbackCampaign {
  id: string;
  name: string;
  description: string;

  // Timing
  startDate: Timestamp;
  endDate: Timestamp;

  // What triggers it
  targetService: string;    // 'airtime' | 'data' | 'electricity' | '*' for any service
  userSegment: UserSegment;

  // Reward
  cashbackType: CashbackType;
  cashbackValue: number;     // percentage (0–100) or flat kobo amount

  // Budget controls (0 = unlimited)
  maxCashbackPerUser: number;  // kobo — per-user cap over campaign lifetime
  totalBudgetKobo: number;     // campaign-level spend cap (0 = unlimited)

  // Stacking
  stackingRule: StackingRule;

  // Counters (updated atomically as cashback fires)
  totalTriggeredCount: number;
  totalPaidKobo: number;

  // Admin
  createdBy: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CashbackRecord {
  id: string;
  campaignId: string;
  userId: string;
  transactionId: string;
  service: string;
  transactionAmountKobo: number;
  cashbackAmountKobo: number;
  status: 'credited' | 'cancelled';
  creditedAt: Timestamp | null;
  cancelledReason?: string;
  createdAt: Timestamp;
}

export interface CashbackEligibilityResult {
  eligible: boolean;
  reason?: string;
  campaign?: CashbackCampaign;
  cashbackAmountKobo?: number;
}

// ─── ELIGIBILITY CHECK ────────────────────────────────────────────────────────

/**
 * Find the best active campaign for a transaction and user, return the
 * cashback amount if eligible.
 *
 * Called from creditWallet/debitWallet flow — must never throw.
 */
export async function evaluateCashback(
  txn: Transaction,
  opts: { couponApplied?: boolean } = {}
): Promise<CashbackEligibilityResult> {
  try {
    if (txn.type !== 'debit' || txn.status !== 'success') {
      return { eligible: false, reason: 'Not a successful debit transaction' };
    }

    const now = Timestamp.now();

    // Fetch all active campaigns that target this service
    const snap = await adminDb
      .collection('cashback_campaigns')
      .where('isActive', '==', true)
      .where('isArchived', '==', false)
      .where('startDate', '<=', now)
      .where('endDate', '>=', now)
      .get();

    if (snap.empty) return { eligible: false, reason: 'No active campaigns' };

    // Filter to campaigns targeting this service
    const candidates = snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as CashbackCampaign)
      .filter(c => c.targetService === txn.category || c.targetService === '*');

    if (!candidates.length) {
      return { eligible: false, reason: 'No campaigns for this service' };
    }

    // Load the user to check segment eligibility
    const userSnap = await adminDb.collection('users').doc(txn.userId).get();
    if (!userSnap.exists) return { eligible: false, reason: 'User not found' };
    const user = userSnap.data() as User;

    // Find best eligible campaign (highest cashback wins if multiple match)
    let bestCampaign: CashbackCampaign | null = null;
    let bestAmount = 0;

    for (const campaign of candidates) {
      // Stacking rule — skip exclusive campaigns if coupon was applied
      if (campaign.stackingRule === 'exclusive' && opts.couponApplied) continue;

      // User segment check
      if (!userMatchesSegment(user, campaign.userSegment)) continue;

      // Per-user cap check
      if (campaign.maxCashbackPerUser > 0) {
        const userTotal = await getUserCampaignTotalKobo(txn.userId, campaign.id);
        if (userTotal >= campaign.maxCashbackPerUser) continue;
      }

      // Global budget check
      if (campaign.totalBudgetKobo > 0 && campaign.totalPaidKobo >= campaign.totalBudgetKobo) {
        continue;
      }

      // Compute this campaign's cashback
      let amount =
        campaign.cashbackType === 'percentage'
          ? Math.floor((txn.amount * campaign.cashbackValue) / 100)
          : campaign.cashbackValue;

      if (amount <= 0) continue;

      // Respect per-user remaining cap
      if (campaign.maxCashbackPerUser > 0) {
        const userTotal = await getUserCampaignTotalKobo(txn.userId, campaign.id);
        const remaining = campaign.maxCashbackPerUser - userTotal;
        amount = Math.min(amount, remaining);
      }

      // Respect global budget remaining
      if (campaign.totalBudgetKobo > 0) {
        const remaining = campaign.totalBudgetKobo - campaign.totalPaidKobo;
        amount = Math.min(amount, remaining);
      }

      if (amount > bestAmount) {
        bestAmount = amount;
        bestCampaign = campaign;
      }
    }

    if (!bestCampaign || bestAmount <= 0) {
      return { eligible: false, reason: 'No qualifying campaigns after cap checks' };
    }

    return {
      eligible: true,
      campaign: bestCampaign,
      cashbackAmountKobo: bestAmount,
    };
  } catch (error) {
    console.error('[cashback:evaluate]', txn.id, error);
    return { eligible: false, reason: 'Evaluation error' };
  }
}

// ─── CREDIT CASHBACK ─────────────────────────────────────────────────────────

/**
 * Execute cashback credit for a qualifying transaction.
 * Idempotent — skips if a record for this transactionId + campaignId exists.
 *
 * Called after debitWallet resolves successfully. Fire-and-forget safe.
 */
export async function triggerCashback(
  txn: Transaction,
  opts: { couponApplied?: boolean } = {}
): Promise<void> {
  try {
    const evaluation = await evaluateCashback(txn, opts);
    if (!evaluation.eligible || !evaluation.campaign || !evaluation.cashbackAmountKobo) return;

    const { campaign, cashbackAmountKobo } = evaluation;

    // Idempotency — one cashback per transaction per campaign
    const existing = await adminDb
      .collection('cashback_records')
      .where('transactionId', '==', txn.id)
      .where('campaignId', '==', campaign.id)
      .limit(1)
      .get();

    if (!existing.empty) return;

    // Write record FIRST so re-runs don't double-credit
    const recordRef = adminDb.collection('cashback_records').doc();
    await recordRef.set({
      campaignId: campaign.id,
      userId: txn.userId,
      transactionId: txn.id,
      service: txn.category,
      transactionAmountKobo: txn.amount,
      cashbackAmountKobo,
      status: 'credited',
      creditedAt: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
    } satisfies Omit<CashbackRecord, 'id'>);

    // Atomic campaign counter update
    await adminDb.collection('cashback_campaigns').doc(campaign.id).update({
      totalTriggeredCount: FieldValue.increment(1),
      totalPaidKobo: FieldValue.increment(cashbackAmountKobo),
      updatedAt: Timestamp.now(),
    });

    // Credit wallet — distinct 'cashback' category so it surfaces separately in history
    await creditWallet(txn.userId, cashbackAmountKobo, {
      category: 'cashback',
      status: 'success',
      reference: generateReference('cashback'),
      metadata: {
        cashbackRecordId: recordRef.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        sourceTransactionId: txn.id,
        service: txn.category,
      },
    });

    notifyCashbackCredited({
      userId: txn.userId,
      campaign,
      cashbackAmountKobo,
      service: txn.category,
    }).catch(console.error);
  } catch (error) {
    console.error('[cashback:trigger]', txn.id, error);
  }
}

// ─── SEGMENT HELPERS ─────────────────────────────────────────────────────────

function userMatchesSegment(user: User, segment: UserSegment): boolean {
  if (segment === 'all') return true;

  if (segment === 'new_users') {
    // Registered within the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const createdAt =
      user.createdAt instanceof Timestamp
        ? user.createdAt.toMillis()
        : new Date(user.createdAt as string).getTime();
    return createdAt >= thirtyDaysAgo;
  }

  if (segment === 'kyc_tier_1') return (user.kycTier ?? 0) >= 1;
  if (segment === 'kyc_tier_2') return (user.kycTier ?? 0) >= 2;

  if (segment === 'plan_starter') return user.plan === 'starter';
  if (segment === 'plan_pro') return user.plan === 'pro';
  if (segment === 'plan_enterprise') return user.plan === 'enterprise';

  return false;
}

async function getUserCampaignTotalKobo(userId: string, campaignId: string): Promise<number> {
  const snap = await adminDb
    .collection('cashback_records')
    .where('userId', '==', userId)
    .where('campaignId', '==', campaignId)
    .where('status', '==', 'credited')
    .get();

  return snap.docs.reduce((sum, d) => sum + (d.data().cashbackAmountKobo as number), 0);
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalTriggeredCount: number;
  totalPaidKobo: number;
  totalBudgetKobo: number;
  budgetUtilisationPct: number;  // 0–100; 0 if no budget cap
  uniqueUsersRewarded: number;
  avgCashbackKobo: number;
  roiEstimate: string;           // human-readable note
  remainingBudgetKobo: number;   // 0 if no cap
  topServices: Array<{ service: string; count: number; totalKobo: number }>;
}

export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const [campaignSnap, recordsSnap] = await Promise.all([
    adminDb.collection('cashback_campaigns').doc(campaignId).get(),
    adminDb.collection('cashback_records')
      .where('campaignId', '==', campaignId)
      .where('status', '==', 'credited')
      .get(),
  ]);

  if (!campaignSnap.exists) throw new Error(`Campaign ${campaignId} not found`);
  const campaign = { id: campaignSnap.id, ...campaignSnap.data() } as CashbackCampaign;

  const records = recordsSnap.docs.map(d => d.data() as Omit<CashbackRecord, 'id'>);

  const uniqueUsers = new Set(records.map(r => r.userId)).size;
  const totalPaid = records.reduce((sum, r) => sum + r.cashbackAmountKobo, 0);
  const avgCashback = records.length > 0 ? Math.floor(totalPaid / records.length) : 0;

  // Top services breakdown
  const serviceMap = new Map<string, { count: number; totalKobo: number }>();
  for (const r of records) {
    const entry = serviceMap.get(r.service) ?? { count: 0, totalKobo: 0 };
    entry.count++;
    entry.totalKobo += r.cashbackAmountKobo;
    serviceMap.set(r.service, entry);
  }
  const topServices = Array.from(serviceMap.entries())
    .map(([service, data]) => ({ service, ...data }))
    .sort((a, b) => b.totalKobo - a.totalKobo)
    .slice(0, 5);

  const budgetUtilisationPct =
    campaign.totalBudgetKobo > 0
      ? Math.min(100, Math.round((totalPaid / campaign.totalBudgetKobo) * 100))
      : 0;

  const remainingBudgetKobo =
    campaign.totalBudgetKobo > 0
      ? Math.max(0, campaign.totalBudgetKobo - totalPaid)
      : 0;

  // Naive ROI: assumes each rewarded transaction would not have happened without the cashback
  const totalTransactionValue = records.reduce((sum, r) => sum + r.transactionAmountKobo, 0);
  const roiMultiple =
    totalPaid > 0 ? (totalTransactionValue / totalPaid).toFixed(1) : 'N/A';
  const roiEstimate =
    roiMultiple !== 'N/A'
      ? `₦${roiMultiple} in transaction volume per ₦1 cashback paid`
      : 'No data yet';

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    totalTriggeredCount: campaign.totalTriggeredCount,
    totalPaidKobo: totalPaid,
    totalBudgetKobo: campaign.totalBudgetKobo,
    budgetUtilisationPct,
    uniqueUsersRewarded: uniqueUsers,
    avgCashbackKobo: avgCashback,
    roiEstimate,
    remainingBudgetKobo,
    topServices,
  };
}

// ─── CAMPAIGN CRUD HELPERS (used by internal API routes) ──────────────────────

export async function listCampaigns(opts: {
  includeArchived?: boolean;
  activeOnly?: boolean;
}): Promise<CashbackCampaign[]> {
  let query = adminDb.collection('cashback_campaigns')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (!opts.includeArchived) query = query.where('isArchived', '==', false);
  if (opts.activeOnly) query = query.where('isActive', '==', true);

  const snap = await query.limit(200).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CashbackCampaign);
}

export async function getCampaign(campaignId: string): Promise<CashbackCampaign | null> {
  const snap = await adminDb.collection('cashback_campaigns').doc(campaignId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CashbackCampaign;
}

// ─── NOTIFICATION HELPER ──────────────────────────────────────────────────────

async function notifyCashbackCredited(opts: {
  userId: string;
  campaign: CashbackCampaign;
  cashbackAmountKobo: number;
  service: string;
}): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(opts.userId).get();
  if (!userSnap.exists) return;

  const user = userSnap.data() as User & {
    notifications: { email: boolean };
    displayName: string;
    email: string;
  };
  if (!user.notifications?.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: user.email,
    subject: `You got ${koboToNaira(opts.cashbackAmountKobo)} cashback! 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Cashback credited 💰</h2>
        <p>Hi ${user.displayName}, you just earned cashback from the <strong>${opts.campaign.name}</strong> campaign.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Cashback amount</td>
            <td style="padding:8px;font-weight:600">${koboToNaira(opts.cashbackAmountKobo)}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Service</td>
            <td style="padding:8px">${opts.service.replace(/_/g, ' ')}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Campaign</td>
            <td style="padding:8px">${opts.campaign.name}</td>
          </tr>
        </table>
        <a href="${appUrl}/dashboard/wallet"
           style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px">
          View wallet
        </a>
      </div>
    `,
    text: `You earned ${koboToNaira(opts.cashbackAmountKobo)} cashback from the ${opts.campaign.name} campaign on your ${opts.service} transaction.`,
  });
}