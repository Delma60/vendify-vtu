// vtu-web/lib/data/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { DataPlan } from '@/types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataNetwork = 'mtn' | 'airtel' | 'glo' | '9mobile';
export type DataCategory = 'SME' | 'Gifting' | 'Corporate' | 'Direct';

export interface DataPlanRecord {
  id: string;
  network: DataNetwork;
  name: string;
  size: string;          // e.g. "1GB", "500MB"
  sizeBytes: number;     // normalised bytes for sorting
  validity: string;      // e.g. "30 days"
  validityDays: number;
  priceKobo: number;
  category: DataCategory;
  providerPlanId: string;
  isActive: boolean;
  updatedAt: Timestamp;
}

export interface ScheduledDataRule {
  id: string;
  userId: string;
  phone: string;
  network: DataNetwork;
  planId: string;
  planName: string;
  priceKobo: number;
  renewalDay: number;          // 1–28 day of month, or 0 = monthly interval
  intervalDays: number | null; // null if renewalDay is used
  isActive: boolean;
  lastTriggeredAt: Timestamp | null;
  nextTriggerAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DataGiftRequest {
  id: string;
  senderId: string;
  recipientEmail: string;
  recipientName: string;
  phone: string;
  network: DataNetwork;
  planId: string;
  planName: string;
  sizeLabel: string;
  priceKobo: number;
  personalMessage: string | null;
  status: 'pending' | 'delivered' | 'failed';
  transactionId: string | null;
  deliveredAt: Timestamp | null;
  createdAt: Timestamp;
}

// ─── Data plan cache (1-hour TTL per network) ─────────────────────────────────

const _planCache = new Map<string, { plans: DataPlanRecord[]|DataPlan[]; expiresAt: number }>();
const PLAN_CACHE_TTL = 60 * 1000; // 1 hour

export async function getDataPlans(
  network: DataNetwork,
  category?: DataCategory
): Promise<DataPlanRecord[]> {
  const cacheKey = `${network}:${category ?? 'all'}`;
  const cached = _planCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.plans;

  let query = adminDb
    .collection('data_plans')
    .where('network', '==', network)
    .where('isActive', '==', true) as FirebaseFirestore.Query;

  if (category) query = query.where('category', '==', category);

  const snap = await query.orderBy('priceKobo', 'asc').get();
  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }) as DataPlanRecord);

  _planCache.set(cacheKey, { plans, expiresAt: Date.now() + PLAN_CACHE_TTL });
  return plans;
}

export async function getAllDataPlans(): Promise<DataPlan[]> {
  const cacheKey = "all:all:al";
  const cached = _planCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.plans as DataPlan[];

  let query = adminDb
    .collection('data_plans') as FirebaseFirestore.Query;


  const snap = await query.orderBy('id', 'asc').get();
  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }) as DataPlanRecord);

  _planCache.set(cacheKey, { plans, expiresAt: Date.now() + PLAN_CACHE_TTL });
  return plans as unknown as DataPlan[];
}

// export async function getAllD

export async function getDataPlanById(planId: string): Promise<DataPlanRecord | null> {
  const snap = await adminDb.collection('data_plans').doc(planId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as DataPlanRecord;
}

export function invalidatePlanCache(): void {
  _planCache.clear();
}

/** Sync plans from the provider router into Firestore. Called by price-sync cron. */
export async function syncDataPlansFromProvider(
  network: DataNetwork,
  providerPlans: Array<{
    providerPlanId: string;
    name: string;
    size: string;
    sizeBytes: number;
    validity: string;
    validityDays: number;
    priceKobo: number;
    category: DataCategory;
  }>
): Promise<{ upserted: number; deactivated: number }> {
  const batch = adminDb.batch();
  const incomingIds = new Set<string>();

  for (const plan of providerPlans) {
    // Stable doc ID: network-providerPlanId
    const docId = `${network}-${plan.providerPlanId}`;
    incomingIds.add(docId);
    const ref = adminDb.collection('data_plans').doc(docId);
    batch.set(ref, {
      network,
      ...plan,
      isActive: true,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  // Deactivate plans no longer offered by the provider
  const existingSnap = await adminDb
    .collection('data_plans')
    .where('network', '==', network)
    .where('isActive', '==', true)
    .get();

  let deactivated = 0;
  for (const doc of existingSnap.docs) {
    if (!incomingIds.has(doc.id)) {
      batch.update(doc.ref, { isActive: false, updatedAt: Timestamp.now() });
      deactivated++;
    }
  }

  await batch.commit();
  invalidatePlanCache();

  return { upserted: providerPlans.length, deactivated };
}

// ─── Scheduled data renewal ───────────────────────────────────────────────────

export async function createScheduledDataRule(
  userId: string,
  input: {
    phone: string;
    network: DataNetwork;
    planId: string;
    renewalDay?: number;        // 1–28
    intervalDays?: number;      // e.g. 30
  }
): Promise<string> {
  const plan = await getDataPlanById(input.planId);
  if (!plan) throw new Error('Data plan not found');
  if (!plan.isActive) throw new Error('This data plan is no longer available');

  // Cap to 5 active rules per user
  const existing = await adminDb
    .collection('scheduled_data_rules')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .get();

  if (existing.size >= 5) {
    throw new Error('You can have at most 5 active scheduled data rules');
  }

  const now = new Date();
  let nextTriggerAt: Date;

  if (input.renewalDay) {
    // Next occurrence of day-of-month
    const d = new Date(now.getFullYear(), now.getMonth(), input.renewalDay);
    if (d <= now) d.setMonth(d.getMonth() + 1);
    nextTriggerAt = d;
  } else {
    const days = input.intervalDays ?? plan.validityDays ?? 30;
    nextTriggerAt = new Date(now.getTime() + days * 86400000);
  }

  const ref = adminDb.collection('scheduled_data_rules').doc();
  await ref.set({
    id: ref.id,
    userId,
    phone: input.phone,
    network: input.network,
    planId: input.planId,
    planName: plan.name,
    priceKobo: plan.priceKobo,
    renewalDay: input.renewalDay ?? null,
    intervalDays: input.intervalDays ?? null,
    isActive: true,
    lastTriggeredAt: null,
    nextTriggerAt: Timestamp.fromDate(nextTriggerAt),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  } satisfies Omit<ScheduledDataRule, 'id' | 'createdAt' | 'updatedAt' | 'nextTriggerAt'> & {
    id: string;
    createdAt: unknown;
    updatedAt: unknown;
    nextTriggerAt: Timestamp;
  });

  return ref.id;
}

export async function listScheduledDataRules(userId: string): Promise<ScheduledDataRule[]> {
  const snap = await adminDb
    .collection('scheduled_data_rules')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as ScheduledDataRule);
}

export async function deleteScheduledDataRule(ruleId: string, userId: string): Promise<void> {
  const ref = adminDb.collection('scheduled_data_rules').doc(ruleId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Rule not found');
  if ((snap.data() as ScheduledDataRule).userId !== userId) throw new Error('Not your rule');
  await ref.update({ isActive: false, updatedAt: Timestamp.now() });
}

/**
 * Cron helper: execute all scheduled data rules that are due.
 */
export async function runScheduledDataRenewals(): Promise<{
  triggered: number;
  skipped: number;
  failed: number;
}> {
  const summary = { triggered: 0, skipped: 0, failed: 0 };
  const now = Timestamp.now();

  const snap = await adminDb
    .collection('scheduled_data_rules')
    .where('isActive', '==', true)
    .where('nextTriggerAt', '<=', now)
    .get();

  for (const doc of snap.docs) {
    const rule = doc.data() as ScheduledDataRule;
    try {
      const plan = await getDataPlanById(rule.planId);
      if (!plan || !plan.isActive) {
        // Plan gone — deactivate rule
        await doc.ref.update({ isActive: false, updatedAt: Timestamp.now() });
        summary.skipped++;
        continue;
      }

      const { calculateFee } = await import('@/lib/fees/engine');
      const { debitWallet, updateTransactionStatus } = await import('@/lib/wallet/operations');
      const { generateReference } = await import('@/lib/utils/reference');
      const { buyData } = await import('@/lib/providers/router');

      const feeCalc = await calculateFee('data', plan.priceKobo);
      const reference = generateReference('data');

      const txnId = await debitWallet(rule.userId, feeCalc.totalChargeKobo, {
        category: 'data',
        status: 'pending',
        reference,
        fee: feeCalc.totalFeeKobo,
        metadata: {
          phone: rule.phone,
          network: rule.network,
          planId: rule.planId,
          planName: rule.planName,
          scheduledRuleId: doc.id,
          requestedAmountKobo: plan.priceKobo,
        },
      });

      const result = await buyData({
        phone: rule.phone,
        network: rule.network,
        planId: plan.providerPlanId,
        amount: plan.priceKobo,
        reference,
      });

      await updateTransactionStatus(txnId, result.success ? 'success' : 'failed', {
        provider: result.provider ?? undefined,
        providerReference: result.providerReference ?? undefined,
        failureReason: result.error ?? undefined,
      });

      if (!result.success && result.shouldRefund) {
        const { creditWallet } = await import('@/lib/wallet/operations');
        await creditWallet(rule.userId, feeCalc.totalChargeKobo, {
          category: 'refund',
          reference: generateReference('refund'),
          metadata: { originalTxnId: txnId, scheduledRuleId: doc.id },
        });
      }

      // Compute next trigger
      const nextDate = computeNextTrigger(rule);
      await doc.ref.update({
        lastTriggeredAt: Timestamp.now(),
        nextTriggerAt: Timestamp.fromDate(nextDate),
        updatedAt: Timestamp.now(),
      });

      summary.triggered++;
    } catch (error) {
      console.error('[scheduled-data]', doc.id, error);
      summary.failed++;
    }
  }

  return summary;
}

function computeNextTrigger(rule: ScheduledDataRule): Date {
  const now = new Date();
  if (rule.renewalDay) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, rule.renewalDay);
    return d;
  }
  const days = rule.intervalDays ?? 30;
  return new Date(now.getTime() + days * 86400000);
}

// ─── Data gifting ─────────────────────────────────────────────────────────────

export async function createDataGift(
  senderId: string,
  input: {
    recipientEmail: string;
    recipientName: string;
    phone: string;
    network: DataNetwork;
    planId: string;
    personalMessage?: string;
    transactionId: string;
  }
): Promise<string> {
  const plan = await getDataPlanById(input.planId);
  if (!plan) throw new Error('Plan not found');

  const ref = adminDb.collection('data_gifts').doc();
  await ref.set({
    id: ref.id,
    senderId,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    phone: input.phone,
    network: input.network,
    planId: input.planId,
    planName: plan.name,
    sizeLabel: plan.size,
    priceKobo: plan.priceKobo,
    personalMessage: input.personalMessage ?? null,
    status: 'pending',
    transactionId: input.transactionId,
    deliveredAt: null,
    createdAt: FieldValue.serverTimestamp(),
  } satisfies Omit<DataGiftRequest, 'id' | 'createdAt'> & { id: string; createdAt: unknown });

  return ref.id;
}

export async function markGiftDelivered(giftId: string): Promise<void> {
  await adminDb.collection('data_gifts').doc(giftId).update({
    status: 'delivered',
    deliveredAt: Timestamp.now(),
  });
}

// ─── Bulk data job ────────────────────────────────────────────────────────────

export type BulkDataJobStatus = 'queued' | 'processing' | 'completed' | 'partial' | 'failed';

export interface BulkDataRow {
  phone: string;
  network: DataNetwork;
  planId: string;
  planName: string;
  priceKobo: number;
  status: 'pending' | 'success' | 'failed';
  reference: string | null;
  error: string | null;
}

export interface BulkDataJob {
  id: string;
  userId: string;
  totalRows: number;
  successCount: number;
  failCount: number;
  totalAmountKobo: number;
  status: BulkDataJobStatus;
  rows: BulkDataRow[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

export async function createBulkDataJob(
  userId: string,
  rows: Array<{ phone: string; network: DataNetwork; planId: string }>
): Promise<string> {
  if (rows.length > 500) throw new Error('Maximum 500 rows per bulk data upload');
  if (rows.length === 0) throw new Error('No rows provided');

  // Resolve plans
  const planCache = new Map<string, DataPlanRecord>();
  const jobRows: BulkDataRow[] = [];

  for (const row of rows) {
    let plan = planCache.get(row.planId);
    if (!plan) {
      const p = await getDataPlanById(row.planId);
      if (!p || !p.isActive) throw new Error(`Plan ${row.planId} not found or inactive`);
      plan = p;
      planCache.set(row.planId, plan);
    }

    jobRows.push({
      phone: row.phone,
      network: row.network,
      planId: row.planId,
      planName: plan.name,
      priceKobo: plan.priceKobo,
      status: 'pending',
      reference: null,
      error: null,
    });
  }

  const totalAmountKobo = jobRows.reduce((s, r) => s + r.priceKobo, 0);
  const ref = adminDb.collection('bulk_data_jobs').doc();

  await ref.set({
    id: ref.id,
    userId,
    totalRows: jobRows.length,
    successCount: 0,
    failCount: 0,
    totalAmountKobo,
    status: 'queued',
    rows: jobRows,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
  });

  return ref.id;
}

export async function getBulkDataJob(jobId: string, userId: string): Promise<BulkDataJob | null> {
  const snap = await adminDb.collection('bulk_data_jobs').doc(jobId).get();
  if (!snap.exists) return null;
  const job = snap.data() as BulkDataJob;
  if (job.userId !== userId) return null;
  return { ...job, id: snap.id };
}

export async function processBulkDataRow(jobId: string, rowIndex: number): Promise<void> {
  const jobRef = adminDb.collection('bulk_data_jobs').doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) return;

  const job = snap.data() as BulkDataJob;
  if (job.status === 'failed') return;

  const row = job.rows[rowIndex];
  if (!row || row.status !== 'pending') return;

  try {
    const { calculateFee } = await import('@/lib/fees/engine');
    const { debitWallet, updateTransactionStatus } = await import('@/lib/wallet/operations');
    const { generateReference } = await import('@/lib/utils/reference');
    const { buyData } = await import('@/lib/providers/router');

    const plan = await getDataPlanById(row.planId);
    if (!plan) throw new Error('Plan not found');

    const feeCalc = await calculateFee('data', row.priceKobo);
    const reference = generateReference('data');

    const txnId = await debitWallet(job.userId, feeCalc.totalChargeKobo, {
      category: 'data',
      status: 'pending',
      reference,
      fee: feeCalc.totalFeeKobo,
      metadata: {
        phone: row.phone,
        network: row.network,
        planId: row.planId,
        planName: row.planName,
        bulkJobId: jobId,
        rowIndex,
      },
    });

    const result = await buyData({
      phone: row.phone,
      network: row.network,
      planId: plan.providerPlanId,
      amount: row.priceKobo,
      reference,
    });

    await updateTransactionStatus(txnId, result.success ? 'success' : 'failed', {
      provider: result.provider ?? undefined,
      providerReference: result.providerReference ?? undefined,
      failureReason: result.error ?? undefined,
    });

    if (!result.success && result.shouldRefund) {
      const { creditWallet } = await import('@/lib/wallet/operations');
      await creditWallet(job.userId, feeCalc.totalChargeKobo, {
        category: 'refund',
        reference: generateReference('refund'),
        metadata: { originalTxnId: txnId, bulkJobId: jobId, rowIndex },
      });
    }

    const updatedRows = [...job.rows];
    updatedRows[rowIndex] = {
      ...row,
      status: result.success ? 'success' : 'failed',
      reference,
      error: result.success ? null : (result.error ?? 'Provider error'),
    };

    const successCount = updatedRows.filter(r => r.status === 'success').length;
    const failCount = updatedRows.filter(r => r.status === 'failed').length;
    const pendingCount = updatedRows.filter(r => r.status === 'pending').length;

    const newStatus: BulkDataJobStatus =
      pendingCount > 0 ? 'processing'
      : failCount === 0 ? 'completed'
      : successCount === 0 ? 'failed'
      : 'partial';

    await jobRef.update({
      rows: updatedRows,
      successCount,
      failCount,
      status: newStatus,
      updatedAt: Timestamp.now(),
      ...(pendingCount === 0 ? { completedAt: Timestamp.now() } : {}),
    });
  } catch (error) {
    const updatedRows = [...job.rows];
    updatedRows[rowIndex] = { ...row, status: 'failed', reference: null, error: (error as Error).message };
    const failCount = updatedRows.filter(r => r.status === 'failed').length;
    const pendingCount = updatedRows.filter(r => r.status === 'pending').length;
    await jobRef.update({
      rows: updatedRows,
      failCount,
      status: pendingCount > 0 ? 'processing' : failCount === updatedRows.length ? 'failed' : 'partial',
      updatedAt: Timestamp.now(),
      ...(pendingCount === 0 ? { completedAt: Timestamp.now() } : {}),
    });
  }
}