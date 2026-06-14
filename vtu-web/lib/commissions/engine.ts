// vtu-web/lib/commissions/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getReferralHierarchy } from '@/lib/users/referrals';
import { creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import type { Transaction } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommissionRate {
  service: string;          // 'airtime' | 'data' | 'electricity' | etc. | '*' for all
  type: 'percentage' | 'flat';
  level1: number;           // rate for direct referrer (% or kobo)
  level2: number;
  level3: number;
  minTransactionAmount: number; // in kobo — don't commission tiny txns
}

export interface CommissionRecord {
  id: string;
  earnedByUserId: string;
  sourceUserId: string;
  transactionId: string;
  level: number;
  amount: number;           // in kobo
  rate: number;
  service: string;
  status: 'pending' | 'credited' | 'cancelled';
  creditedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface CommissionCalculationResult {
  eligible: boolean;
  reason?: string;
  commissions: Array<{
    earnedByUserId: string;
    level: number;
    amount: number;
    rate: number;
  }>;
}

// ─── Load commission config ───────────────────────────────────────────────────

/**
 * Load commission rates from Firestore system config.
 * Falls back to safe defaults if config doc is missing.
 */
async function loadCommissionRates(): Promise<CommissionRate[]> {
  const snap = await adminDb.collection('system_settings').doc('commissions').get();

  if (snap.exists) {
    const data = snap.data() as { rates?: CommissionRate[] };
    if (data.rates?.length) return data.rates;
  }

  // Safe defaults — admin should configure these via admin panel
  return [
    { service: 'airtime',     type: 'percentage', level1: 0.5, level2: 0.2, level3: 0.1, minTransactionAmount: 5000 },
    { service: 'data',        type: 'percentage', level1: 1.0, level2: 0.4, level3: 0.2, minTransactionAmount: 5000 },
    { service: 'electricity', type: 'flat',       level1: 5000, level2: 2000, level3: 1000, minTransactionAmount: 50000 },
    { service: 'cable',       type: 'flat',       level1: 5000, level2: 2000, level3: 1000, minTransactionAmount: 50000 },
    { service: '*',           type: 'percentage', level1: 0.3, level2: 0.1, level3: 0.05, minTransactionAmount: 5000 },
  ];
}

function findRateForService(rates: CommissionRate[], service: string): CommissionRate | null {
  return (
    rates.find(r => r.service === service) ??
    rates.find(r => r.service === '*') ??
    null
  );
}

function levelRateValue(rate: CommissionRate, level: number): number {
  if (level === 1) return rate.level1;
  if (level === 2) return rate.level2;
  if (level === 3) return rate.level3;
  return 0;
}

// ─── CALCULATE ────────────────────────────────────────────────────────────────

export async function calculateCommission(
  txn: Transaction
): Promise<CommissionCalculationResult> {
  // Only commission successful debits for VTU services
  const commissionableCategories = new Set([
    'airtime', 'data', 'electricity', 'cable', 'exam_pin', 'sms', 'bucket_purchase',
  ]);

  if (txn.type !== 'debit' || txn.status !== 'success') {
    return { eligible: false, reason: 'Not a successful debit', commissions: [] };
  }

  if (!commissionableCategories.has(txn.category)) {
    return { eligible: false, reason: `Category '${txn.category}' is not commissionable`, commissions: [] };
  }

  const rates = await loadCommissionRates();
  const rate = findRateForService(rates, txn.category);

  if (!rate) {
    return { eligible: false, reason: 'No rate configured for this service', commissions: [] };
  }

  if (txn.amount < rate.minTransactionAmount) {
    return { eligible: false, reason: 'Transaction amount below minimum threshold', commissions: [] };
  }

  const hierarchy = await getReferralHierarchy(txn.userId);
  if (!hierarchy.length) {
    return { eligible: false, reason: 'No referral chain found', commissions: [] };
  }

  const commissions = hierarchy.map(referrer => {
    const levelRate = levelRateValue(rate, referrer.level);
    const amount =
      rate.type === 'percentage'
        ? Math.floor((txn.amount * levelRate) / 100)
        : levelRate;

    return {
      earnedByUserId: referrer.userId,
      level: referrer.level,
      amount,
      rate: levelRate,
    };
  }).filter(c => c.amount > 0);

  return { eligible: commissions.length > 0, commissions };
}

// ─── TRIGGER (called after debitWallet) ──────────────────────────────────────

/**
 * Enqueue commission records for a completed transaction.
 * Called non-blockingly from debitWallet — must never throw.
 */
export async function triggerCommissions(
  userId: string,
  transactionId: string
): Promise<void> {
  try {
    // Verify not already processed
    const existing = await adminDb
      .collection('commissions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (!existing.empty) return; // idempotent

    const txnSnap = await adminDb.collection('transactions').doc(transactionId).get();
    if (!txnSnap.exists) return;

    const txn = txnSnap.data() as Transaction;
    const result = await calculateCommission(txn);

    if (!result.eligible || !result.commissions.length) return;

    const batch = adminDb.batch();

    for (const commission of result.commissions) {
      const ref = adminDb.collection('commissions').doc();
      batch.set(ref, {
        earnedByUserId: commission.earnedByUserId,
        sourceUserId: userId,
        transactionId,
        level: commission.level,
        amount: commission.amount,
        rate: commission.rate,
        service: txn.category,
        status: 'pending',
        creditedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      } satisfies Omit<CommissionRecord, 'id'>);
    }

    await batch.commit();
  } catch (error) {
    // Non-blocking — log but don't crash the parent transaction
    console.error('[commissions:trigger]', transactionId, error);
  }
}

// ─── SETTLE (called by cron) ──────────────────────────────────────────────────

export interface CommissionPayoutSummary {
  processed: number;
  credited: number;
  failed: number;
  totalKoboCredited: number;
}

/**
 * Process all pending commission records and credit to earner wallets.
 * Designed to be idempotent — safe to run multiple times.
 */
export async function settlePendingCommissions(): Promise<CommissionPayoutSummary> {
  const summary: CommissionPayoutSummary = {
    processed: 0,
    credited: 0,
    failed: 0,
    totalKoboCredited: 0,
  };

  // Process in batches to avoid timeout
  const snap = await adminDb
    .collection('commissions')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();

  if (snap.empty) return summary;

  for (const doc of snap.docs) {
    summary.processed++;
    const commission = { id: doc.id, ...doc.data() } as CommissionRecord;

    try {
      // Verify source transaction still succeeded (refunds could invalidate it)
      const txnSnap = await adminDb.collection('transactions').doc(commission.transactionId).get();
      if (!txnSnap.exists || txnSnap.data()?.status !== 'success') {
        await doc.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() });
        continue;
      }

      // Credit the earner's wallet
      await creditWallet(commission.earnedByUserId, commission.amount, {
        category: 'commission',
        status: 'success',
        reference: generateReference('commission'),
        metadata: {
          commissionId: commission.id,
          sourceUserId: commission.sourceUserId,
          transactionId: commission.transactionId,
          level: commission.level,
          service: commission.service,
        },
      });

      // Mark as credited
      await doc.ref.update({
        status: 'credited',
        creditedAt: Timestamp.now(),
      });

      summary.credited++;
      summary.totalKoboCredited += commission.amount;

      // Notify earner (non-blocking)
      notifyCommissionCredited(commission).catch(console.error);
    } catch (error) {
      console.error('[commissions:settle]', commission.id, error);
      summary.failed++;
    }
  }

  return summary;
}

// ─── HISTORY (user-facing) ────────────────────────────────────────────────────

export interface CommissionHistoryOptions {
  userId: string;
  status?: CommissionRecord['status'];
  page?: number;
  pageSize?: number;
}

export async function getCommissionHistory(opts: CommissionHistoryOptions): Promise<{
  commissions: CommissionRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  totalPending: number;
  totalCredited: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, opts.pageSize ?? 20);

  let query = adminDb
    .collection('commissions')
    .where('earnedByUserId', '==', opts.userId)
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (opts.status) {
    query = query.where('status', '==', opts.status);
  }

  const snap = await query
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize)
    .get();

  const hasMore = snap.docs.length > pageSize;
  const commissions = snap.docs.slice(0, pageSize).map(d => ({
    id: d.id,
    ...d.data(),
  })) as CommissionRecord[];

  // Aggregate totals (separate queries for accuracy)
  const [pendingSnap, creditedSnap] = await Promise.all([
    adminDb.collection('commissions')
      .where('earnedByUserId', '==', opts.userId)
      .where('status', '==', 'pending')
      .get(),
    adminDb.collection('commissions')
      .where('earnedByUserId', '==', opts.userId)
      .where('status', '==', 'credited')
      .get(),
  ]);

  const totalPending = pendingSnap.docs.reduce((sum, d) => sum + (d.data().amount as number), 0);
  const totalCredited = creditedSnap.docs.reduce((sum, d) => sum + (d.data().amount as number), 0);

  return { commissions, hasMore, page, pageSize, totalPending, totalCredited };
}

// ─── ADMIN REPORT ─────────────────────────────────────────────────────────────

export async function getCommissionReport(opts: {
  startDate?: Date;
  endDate?: Date;
  status?: CommissionRecord['status'];
  earnedByUserId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ commissions: CommissionRecord[]; hasMore: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 50);

  let query = adminDb
    .collection('commissions')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (opts.earnedByUserId) query = query.where('earnedByUserId', '==', opts.earnedByUserId);
  if (opts.status) query = query.where('status', '==', opts.status);
  if (opts.startDate) query = query.where('createdAt', '>=', Timestamp.fromDate(opts.startDate));
  if (opts.endDate) query = query.where('createdAt', '<=', Timestamp.fromDate(opts.endDate));

  const snap = await query.limit(pageSize + 1).offset((page - 1) * pageSize).get();
  const hasMore = snap.docs.length > pageSize;

  return {
    commissions: snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() })) as CommissionRecord[],
    hasMore,
  };
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function notifyCommissionCredited(commission: CommissionRecord): Promise<void> {
  const [userSnap] = await Promise.all([
    adminDb.collection('users').doc(commission.earnedByUserId).get(),
  ]);

  if (!userSnap.exists) return;
  const user = userSnap.data() as { email: string; displayName: string; notifications: { email: boolean } };
  if (!user.notifications.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: user.email,
    subject: `Commission earned: ${koboToNaira(commission.amount)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Commission credited 🎉</h2>
        <p>Hi ${user.displayName}, you've earned a commission from your referral network.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Amount</td>
            <td style="padding:8px;font-weight:600">${koboToNaira(commission.amount)}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Service</td>
            <td style="padding:8px">${commission.service.replace(/_/g, ' ')}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Referral level</td>
            <td style="padding:8px">Level ${commission.level}</td>
          </tr>
        </table>
        <a href="${appUrl}/dashboard/commissions"
           style="display:inline-block;padding:12px 24px;background:#047857;color:#fff;text-decoration:none;border-radius:6px">
          View commission history
        </a>
      </div>
    `,
    text: `You earned a Level ${commission.level} commission of ${koboToNaira(commission.amount)} from a ${commission.service} transaction.`,
  });
}