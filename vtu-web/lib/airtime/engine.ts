// vtu-web/lib/airtime/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)
import {
  NigerianNetwork,
  detectNetwork,
  normalisePhone,
  NIGERIAN_NETWORKS,
} from './utils';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Re-export so `@/lib/airtime/bulk/route.ts`, `auto-recharge/route.ts`, and
// `a2c/route.ts` can pull these from `engine.ts` (their existing import path)
// instead of needing to know about `./utils`.
export { NIGERIAN_NETWORKS, normalisePhone, detectNetwork };
export type { NigerianNetwork };


// ─── Airtime-to-Cash rates ────────────────────────────────────────────────────

export interface A2CRate {
  network: NigerianNetwork;
  ratePercent: number;        // e.g. 75 means user gets 75% of face value
  minAmountKobo: number;
  maxAmountKobo: number;
  isActive: boolean;
  updatedBy: string;
  updatedAt: Timestamp;
}

// Simple in-memory cache for rates (2-min TTL)
let _rateCache: A2CRate[] | null = null;
let _rateCacheExpiresAt = 0;

export async function loadA2CRates(): Promise<A2CRate[]> {
  if (_rateCache && Date.now() < _rateCacheExpiresAt) return _rateCache;
  const snap = await adminDb.collection('airtime_to_cash_rates').get();
  _rateCache = snap.docs.map(d => d.data() as A2CRate);
  _rateCacheExpiresAt = Date.now() + 120_000;
  return _rateCache;
}

export function invalidateRateCache(): void {
  _rateCache = null;
  _rateCacheExpiresAt = 0;
}

export async function getA2CRate(network: NigerianNetwork): Promise<A2CRate | null> {
  const rates = await loadA2CRates();
  return rates.find(r => r.network === network && r.isActive) ?? null;
}

export async function upsertA2CRate(
  input: Omit<A2CRate, 'updatedAt'>,
  adminId: string
): Promise<void> {
  if (input.ratePercent <= 0 || input.ratePercent > 100) {
    throw new Error('Rate must be between 1 and 100%');
  }
  const doc: A2CRate = { ...input, updatedBy: adminId, updatedAt: Timestamp.now() };
  await adminDb.collection('airtime_to_cash_rates').doc(input.network).set(doc);
  invalidateRateCache();

  await adminDb.collection('audit_logs').add({
    adminId,
    action: 'a2c_rate:upsert',
    resource: 'airtime_to_cash_rates',
    targetId: input.network,
    after: doc,
    ip: 'server',
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ─── Airtime-to-Cash requests ─────────────────────────────────────────────────

export type A2CStatus = 'pending' | 'approved' | 'rejected' | 'credited';

export interface A2CRequest {
  id: string;
  userId: string;
  network: NigerianNetwork;
  phone: string;
  faceValueKobo: number;      // what user says the airtime is worth
  payoutKobo: number;         // calculated: faceValue * ratePercent / 100
  ratePercent: number;
  status: A2CStatus;
  adminNote: string | null;
  assignedTo: string | null;
  creditedTxnId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function createA2CRequest(
  userId: string,
  input: { network: NigerianNetwork; phone: string; faceValueKobo: number }
): Promise<{ requestId: string; payoutKobo: number; ratePercent: number }> {
  const rate = await getA2CRate(input.network);
  if (!rate) throw new Error(`Airtime-to-cash is not available for ${input.network}`);

  if (input.faceValueKobo < rate.minAmountKobo) {
    throw new Error(`Minimum airtime-to-cash amount is ₦${rate.minAmountKobo / 100}`);
  }
  if (rate.maxAmountKobo > 0 && input.faceValueKobo > rate.maxAmountKobo) {
    throw new Error(`Maximum airtime-to-cash amount is ₦${rate.maxAmountKobo / 100}`);
  }

  const payoutKobo = Math.floor((input.faceValueKobo * rate.ratePercent) / 100);
  const ref = adminDb.collection('airtime_to_cash_requests').doc();

  await ref.set({
    id: ref.id,
    userId,
    network: input.network,
    phone: normalisePhone(input.phone),
    faceValueKobo: input.faceValueKobo,
    payoutKobo,
    ratePercent: rate.ratePercent,
    status: 'pending',
    adminNote: null,
    assignedTo: null,
    creditedTxnId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  } satisfies Omit<A2CRequest, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: unknown; updatedAt: unknown; id: string });

  return { requestId: ref.id, payoutKobo, ratePercent: rate.ratePercent };
}

export async function processA2CRequest(
  requestId: string,
  action: 'approve' | 'reject',
  adminId: string,
  adminNote?: string
): Promise<void> {
  const ref = adminDb.collection('airtime_to_cash_requests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found');

  const request = snap.data() as A2CRequest;
  if (request.status !== 'pending') {
    throw new Error(`Request is already ${request.status}`);
  }

  if (action === 'reject') {
    await ref.update({
      status: 'rejected',
      adminNote: adminNote ?? null,
      assignedTo: adminId,
      updatedAt: Timestamp.now(),
    });
    return;
  }

  // Approve → credit wallet
  const { creditWallet } = await import('@/lib/wallet/operations');
  const { generateReference } = await import('@/lib/utils/reference');

  const txnId = await creditWallet(request.userId, request.payoutKobo, {
    category: 'airtime_to_cash',
    status: 'success',
    reference: generateReference('airtime_to_cash'),
    metadata: {
      a2cRequestId: requestId,
      network: request.network,
      phone: request.phone,
      faceValueKobo: request.faceValueKobo,
      ratePercent: request.ratePercent,
    },
  });

  await ref.update({
    status: 'credited',
    adminNote: adminNote ?? null,
    assignedTo: adminId,
    creditedTxnId: txnId,
    updatedAt: Timestamp.now(),
  });

  // Notify user (non-blocking)
  notifyA2CApproved(request, txnId).catch(console.error);
}

async function notifyA2CApproved(request: A2CRequest, txnId: string): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(request.userId).get();
  if (!userSnap.exists) return;
  const user = userSnap.data() as { email: string; displayName: string; notifications: { email: boolean } };
  if (!user.notifications?.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: user.email,
    subject: `Airtime-to-Cash approved — ${koboToNaira(request.payoutKobo)} credited`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Airtime-to-Cash Approved ✅</h2>
        <p>Hi ${user.displayName}, your airtime-to-cash request has been approved and credited to your wallet.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Network</td><td style="padding:8px;font-weight:600;text-transform:uppercase">${request.network}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Phone</td><td style="padding:8px">${request.phone}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Airtime value</td><td style="padding:8px">${koboToNaira(request.faceValueKobo)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Rate</td><td style="padding:8px">${request.ratePercent}%</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Credited to wallet</td><td style="padding:8px;font-weight:600;color:#059669">${koboToNaira(request.payoutKobo)}</td></tr>
        </table>
        <a href="${appUrl}/dashboard/wallet" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px">View wallet</a>
      </div>
    `,
    text: `Your airtime-to-cash of ${koboToNaira(request.payoutKobo)} has been credited. Txn: ${txnId}`,
  });
}

// ─── Bulk airtime job queue ───────────────────────────────────────────────────

export type BulkJobStatus = 'queued' | 'processing' | 'completed' | 'partial' | 'failed';

export interface BulkAirtimeRow {
  phone: string;
  network: string;            // auto-detected if blank
  amount: number;             // kobo
  status: 'pending' | 'success' | 'failed';
  reference: string | null;
  error: string | null;
}

export interface BulkAirtimeJob {
  id: string;
  userId: string;
  totalRows: number;
  successCount: number;
  failCount: number;
  totalAmountKobo: number;
  totalFeeKobo: number;
  status: BulkJobStatus;
  rows: BulkAirtimeRow[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

export async function createBulkJob(
  userId: string,
  rows: Array<{ phone: string; network?: string; amount: number }>
): Promise<string> {
  if (rows.length > 1000) throw new Error('Maximum 1,000 rows per bulk upload');
  if (rows.length === 0) throw new Error('No rows to process');

  const jobRows: BulkAirtimeRow[] = rows.map(r => ({
    phone: normalisePhone(r.phone),
    network: r.network || detectNetwork(r.phone) || '',
    amount: r.amount,
    status: 'pending',
    reference: null,
    error: null,
  }));

  // Validate: all rows must have a resolvable network
  const invalid = jobRows.filter(r => !r.network);
  if (invalid.length > 0) {
    throw new Error(
      `Could not detect network for ${invalid.length} number(s): ${invalid.slice(0, 3).map(r => r.phone).join(', ')}${invalid.length > 3 ? '...' : ''}. Please specify the network column.`
    );
  }

  const totalAmountKobo = jobRows.reduce((s, r) => s + r.amount, 0);

  const ref = adminDb.collection('bulk_airtime_jobs').doc();
  await ref.set({
    id: ref.id,
    userId,
    totalRows: jobRows.length,
    successCount: 0,
    failCount: 0,
    totalAmountKobo,
    totalFeeKobo: 0,         // updated as rows complete
    status: 'queued',
    rows: jobRows,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
  } satisfies Omit<BulkAirtimeJob, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> & { id: string; createdAt: unknown; updatedAt: unknown; completedAt: null });

  return ref.id;
}

export async function getBulkJob(jobId: string, userId: string): Promise<BulkAirtimeJob | null> {
  const snap = await adminDb.collection('bulk_airtime_jobs').doc(jobId).get();
  if (!snap.exists) return null;
  const job = snap.data() as BulkAirtimeJob;
  if (job.userId !== userId) return null; // ownership check
  return { ...job, id: snap.id };
}

/**
 * Process one row of a bulk job. Called by the background processor cron.
 * Updates the row status in-place inside the job document.
 */
export async function processBulkJobRow(
  jobId: string,
  rowIndex: number
): Promise<void> {
  const jobRef = adminDb.collection('bulk_airtime_jobs').doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) return;

  const job = snap.data() as BulkAirtimeJob;
  if (job.status === 'failed') return;

  const row = job.rows[rowIndex];
  if (!row || row.status !== 'pending') return;

  try {
    const { calculateFee } = await import('@/lib/fees/engine');
    const { debitWallet } = await import('@/lib/wallet/operations');
    const { generateReference } = await import('@/lib/utils/reference');
    const { buyAirtime } = await import('@/lib/providers/router');

    const feeCalc = await calculateFee('airtime', row.amount);
    const reference = generateReference('airtime');

    // Debit wallet for this row
    const txnId = await debitWallet(
      job.userId,
      feeCalc.totalChargeKobo,
      {
        category: 'airtime',
        status: 'pending',
        reference,
        fee: feeCalc.totalFeeKobo,
        metadata: {
          phone: row.phone,
          network: row.network,
          bulkJobId: jobId,
          rowIndex,
          requestedAmountKobo: row.amount,
        },
      }
    );

    // Call provider
    const result = await buyAirtime({
      phone: row.phone,
      network: row.network,
      amount: row.amount,
      reference,
    });

    const updatedRows = [...job.rows];
    updatedRows[rowIndex] = {
      ...row,
      status: result.success ? 'success' : 'failed',
      reference,
      error: result.success ? null : (result.error ?? 'Provider error'),
    };

    // Update transaction status
    const { updateTransactionStatus } = await import('@/lib/wallet/operations');
    if (result.success) {
      await updateTransactionStatus(txnId, 'success', {
        provider: result.provider ?? undefined,
        providerReference: result.providerReference ?? undefined,
      });
    } else {
      await updateTransactionStatus(txnId, 'failed', { failureReason: result.error ?? undefined });
      if (result.shouldRefund) {
        const { creditWallet } = await import('@/lib/wallet/operations');
        await creditWallet(job.userId, feeCalc.totalChargeKobo, {
          category: 'refund',
          reference: generateReference('refund'),
          metadata: { originalTxnId: txnId, bulkJobId: jobId, rowIndex },
        });
      }
    }

    const successCount = updatedRows.filter(r => r.status === 'success').length;
    const failCount = updatedRows.filter(r => r.status === 'failed').length;
    const pendingCount = updatedRows.filter(r => r.status === 'pending').length;

    const newStatus: BulkJobStatus =
      pendingCount > 0 ? 'processing'
      : failCount === 0 ? 'completed'
      : successCount === 0 ? 'failed'
      : 'partial';

    await jobRef.update({
      rows: updatedRows,
      successCount,
      failCount,
      totalFeeKobo: FieldValue.increment(result.success ? feeCalc.totalFeeKobo : 0),
      status: newStatus,
      updatedAt: Timestamp.now(),
      ...(pendingCount === 0 ? { completedAt: Timestamp.now() } : {}),
    });

    // Notify user on completion (non-blocking)
    if (pendingCount === 0) {
      notifyBulkComplete(job.userId, jobId, successCount, failCount).catch(console.error);
    }
  } catch (error) {
    const updatedRows = [...job.rows];
    updatedRows[rowIndex] = {
      ...row,
      status: 'failed',
      reference: null,
      error: (error as Error).message,
    };
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

async function notifyBulkComplete(
  userId: string, jobId: string, successCount: number, failCount: number
): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return;
  const user = userSnap.data() as { email: string; displayName: string; notifications: { email: boolean } };
  if (!user.notifications?.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: user.email,
    subject: `Bulk airtime complete — ${successCount} sent, ${failCount} failed`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bulk Airtime Completed</h2>
        <p>Hi ${user.displayName}, your bulk airtime job has finished.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Successful</td><td style="padding:8px;color:#059669;font-weight:600">${successCount}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Failed</td><td style="padding:8px;color:${failCount > 0 ? '#dc2626' : '#6b7280'};font-weight:600">${failCount}</td></tr>
        </table>
        <a href="${appUrl}/dashboard/airtime/bulk/${jobId}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px">View full report</a>
      </div>
    `,
    text: `Bulk airtime done: ${successCount} sent, ${failCount} failed. View report at ${appUrl}/dashboard/airtime/bulk/${jobId}`,
  });
}

// ─── Auto-recharge rules ──────────────────────────────────────────────────────

export interface AutoRechargeRule {
  id: string;
  userId: string;
  phone: string;
  network: NigerianNetwork;
  triggerBalanceKobo: number;   // recharge when balance drops below this
  rechargeAmountKobo: number;   // how much to top up
  isActive: boolean;
  lastTriggeredAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function upsertAutoRechargeRule(
  userId: string,
  input: {
    phone: string;
    network: NigerianNetwork;
    triggerBalanceKobo: number;
    rechargeAmountKobo: number;
  }
): Promise<string> {
  if (input.rechargeAmountKobo < 10_00) {
    throw new Error('Minimum auto-recharge amount is ₦10');
  }
  if (input.triggerBalanceKobo < 0) {
    throw new Error('Trigger balance cannot be negative');
  }

  // One rule per phone number per user
  const existing = await adminDb
    .collection('auto_recharge_rules')
    .where('userId', '==', userId)
    .where('phone', '==', normalisePhone(input.phone))
    .limit(1)
    .get();

  const phone = normalisePhone(input.phone);

  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    await ref.update({
      network: input.network,
      triggerBalanceKobo: input.triggerBalanceKobo,
      rechargeAmountKobo: input.rechargeAmountKobo,
      isActive: true,
      updatedAt: Timestamp.now(),
    });
    return ref.id;
  }

  const ref = adminDb.collection('auto_recharge_rules').doc();
  await ref.set({
    id: ref.id,
    userId,
    phone,
    network: input.network,
    triggerBalanceKobo: input.triggerBalanceKobo,
    rechargeAmountKobo: input.rechargeAmountKobo,
    isActive: true,
    lastTriggeredAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

export async function listAutoRechargeRules(userId: string): Promise<AutoRechargeRule[]> {
  const snap = await adminDb
    .collection('auto_recharge_rules')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as AutoRechargeRule);
}

export async function deleteAutoRechargeRule(ruleId: string, userId: string): Promise<void> {
  const ref = adminDb.collection('auto_recharge_rules').doc(ruleId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Rule not found');
  if ((snap.data() as AutoRechargeRule).userId !== userId) throw new Error('Not your rule');
  // Soft-delete per rule #8
  await ref.update({ isActive: false, updatedAt: Timestamp.now() });
}

/**
 * Called by the auto-recharge cron. Finds active rules where the user's
 * wallet balance is below the trigger threshold and fires a top-up.
 * Throttled: one trigger per rule per 6 hours to prevent runaway charges.
 */
export async function runAutoRecharges(): Promise<{
  triggered: number;
  skipped: number;
  failed: number;
}> {
  const summary = { triggered: 0, skipped: 0, failed: 0 };

  const snap = await adminDb
    .collection('auto_recharge_rules')
    .where('isActive', '==', true)
    .get();

  const sixHoursAgo = Timestamp.fromDate(new Date(Date.now() - 6 * 60 * 60 * 1000));

  for (const doc of snap.docs) {
    const rule = doc.data() as AutoRechargeRule;

    // Throttle: skip if triggered within last 6 hours
    if (rule.lastTriggeredAt && rule.lastTriggeredAt.toMillis() > sixHoursAgo.toMillis()) {
      summary.skipped++;
      continue;
    }

    try {
      // Load wallet balance
      const walletSnap = await adminDb.collection('wallets').doc(rule.userId).get();
      if (!walletSnap.exists) { summary.skipped++; continue; }
      const wallet = walletSnap.data() as { balance: number };

      if (wallet.balance >= rule.triggerBalanceKobo) {
        summary.skipped++;
        continue;
      }

      // Load user
      const userSnap = await adminDb.collection('users').doc(rule.userId).get();
      if (!userSnap.exists || !(userSnap.data() as any).isActive) {
        summary.skipped++;
        continue;
      }

      // Fire purchase
      const { calculateFee } = await import('@/lib/fees/engine');
      const { debitWallet, updateTransactionStatus } = await import('@/lib/wallet/operations');
      const { generateReference } = await import('@/lib/utils/reference');
      const { buyAirtime } = await import('@/lib/providers/router');

      const feeCalc = await calculateFee('airtime', rule.rechargeAmountKobo);
      const reference = generateReference('airtime');

      const txnId = await debitWallet(rule.userId, feeCalc.totalChargeKobo, {
        category: 'airtime',
        status: 'pending',
        reference,
        fee: feeCalc.totalFeeKobo,
        metadata: {
          phone: rule.phone,
          network: rule.network,
          autoRechargeRuleId: doc.id,
          triggerBalanceKobo: rule.triggerBalanceKobo,
        },
      });

      const result = await buyAirtime({
        phone: rule.phone,
        network: rule.network,
        amount: rule.rechargeAmountKobo,
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
          metadata: { originalTxnId: txnId, autoRechargeRuleId: doc.id },
        });
      }

      // Update last triggered timestamp
      await doc.ref.update({ lastTriggeredAt: Timestamp.now(), updatedAt: Timestamp.now() });

      summary.triggered++;
    } catch (error) {
      console.error('[auto-recharge]', doc.id, error);
      summary.failed++;
    }
  }

  return summary;
}