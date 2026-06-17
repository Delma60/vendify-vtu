// vtu-web/app/api/internal/transactions/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err, parseIp } from '@/lib/utils/response';
import { creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import type { Transaction } from '@/types';

// ─── Validation ────────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed', 'reversed', 'disputed']).optional(),
  type: z.enum(['credit', 'debit']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),           // reference or providerReference
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
});

const UpdateStatusSchema = z.object({
  txnId: z.string().min(1, 'txnId is required'),
  status: z.enum(['success', 'failed', 'reversed', 'disputed']),
  reason: z.string().min(3, 'Reason is required').max(500),
});

const RefundSchema = z.object({
  txnId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

const BulkRefundSchema = z.object({
  txnIds: z.array(z.string().min(1)).min(1).max(50, 'Max 50 transactions per bulk refund'),
  reason: z.string().min(3).max(500),
});

// ─── GET — list transactions (admin view, cross-user) ─────────────────────────

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.TRANSACTIONS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { page, pageSize, userId, category, status, type, startDate, endDate, search, minAmount, maxAmount } = parsed.data;

  try {
    let query = adminDb.collection('transactions').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

    // Apply filters — note: Firestore requires compound index for multi-field filters
    if (userId) query = query.where('userId', '==', userId);
    if (category) query = query.where('category', '==', category);
    if (status) query = query.where('status', '==', status);
    if (type) query = query.where('type', '==', type);
    if (startDate) query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(startDate)));
    if (endDate) query = query.where('createdAt', '<=', Timestamp.fromDate(new Date(endDate)));
    if (minAmount !== undefined) query = query.where('amount', '>=', minAmount);
    if (maxAmount !== undefined) query = query.where('amount', '<=', maxAmount);

    // For reference search we need to over-fetch then filter in memory
    const fetchLimit = search ? Math.min(500, pageSize * 20) : pageSize + 1;
    query = query.limit(fetchLimit);

    // Offset pagination for non-search queries
    if (!search && page > 1) {
      const offsetSnap = await adminDb
        .collection('transactions')
        .orderBy('createdAt', 'desc')
        .limit((page - 1) * pageSize)
        .get();
      if (!offsetSnap.empty) {
        query = query.startAfter(offsetSnap.docs[offsetSnap.docs.length - 1]);
      }
    }

    const snap = await query.get();
    let txns = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Transaction);

    // In-memory reference search
    if (search) {
      const q = search.toLowerCase();
      txns = txns.filter(
        t =>
          t.reference?.toLowerCase().includes(q) ||
          t.providerReference?.toLowerCase().includes(q) ||
          t.userId?.toLowerCase().includes(q)
      );
      const start = (page - 1) * pageSize;
      const hasMore = txns.length > start + pageSize;
      txns = txns.slice(start, start + pageSize);

      // Aggregate stats for filtered result
      const stats = buildStats(txns);
      return ok({ transactions: txns, pagination: { page, pageSize, hasMore }, stats });
    }

    const hasMore = txns.length > pageSize;
    if (hasMore) txns.pop();

    // Aggregate quick stats (on this page — for header cards)
    const stats = buildStats(txns);

    // Enrich with user display names (batch read)
    const txnsWithUsers = await enrichWithUserNames(txns);

    return ok({
      transactions: txnsWithUsers,
      pagination: { page, pageSize, hasMore },
      stats,
    });
  } catch (e: any) {
    console.error('[GET /api/internal/transactions]', e);
    return err('Failed to load transactions', 500);
  }
}

// ─── PUT — update transaction status ──────────────────────────────────────────

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.TRANSACTIONS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { txnId, status, reason } = parsed.data;

  const ref = adminDb.collection('transactions').doc(txnId);
  const snap = await ref.get();
  if (!snap.exists) return err('Transaction not found', 404);

  const txn = snap.data() as Transaction;
  const before = { status: txn.status };

  await ref.update({
    status,
    adminNote: reason,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: `transaction:status_update:${status}`,
    resource: 'transactions',
    targetId: txnId,
    before,
    after: { status, reason },
    ip: parseIp(request),
  });

  return ok({ txnId, status }, `Transaction status updated to ${status}.`);
}

// ─── POST — refund or bulk-refund ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.TRANSACTIONS_REFUND);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const action: string = body?.action ?? 'refund';

  // ── Bulk refund ─────────────────────────────────────────────────────────────
  if (action === 'bulk_refund') {
    const parsed = BulkRefundSchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const { txnIds, reason } = parsed.data;
    const results: { txnId: string; success: boolean; error?: string; refundTxnId?: string }[] = [];

    for (const txnId of txnIds) {
      try {
        const result = await processRefund(txnId, reason, ctx.uid, parseIp(request));
        results.push({ txnId, success: true, refundTxnId: result.refundTxnId });
      } catch (e: any) {
        results.push({ txnId, success: false, error: e.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    return ok(
      { results, succeeded, failed: results.length - succeeded },
      `${succeeded}/${results.length} refunds processed.`
    );
  }

  // ── Single refund ───────────────────────────────────────────────────────────
  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    const result = await processRefund(parsed.data.txnId, parsed.data.reason, ctx.uid, parseIp(request));
    return ok(result, 'Refund processed successfully.');
  } catch (e: any) {
    return err(e.message, 400);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function processRefund(
  txnId: string,
  reason: string,
  adminId: string,
  ip: string
): Promise<{ txnId: string; refundTxnId: string; amountKobo: number }> {
  const ref = adminDb.collection('transactions').doc(txnId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Transaction ${txnId} not found`);

  const txn = snap.data() as Transaction;

  if (txn.type !== 'debit') throw new Error('Only debit transactions can be refunded');
  if (txn.status === 'reversed') throw new Error('Transaction has already been refunded');
  if (txn.status === 'pending') throw new Error('Cannot refund a pending transaction');

  const totalToRefund = txn.amount; // includes fee — refund total charged amount

  // Credit the wallet
  const refundTxnId = await creditWallet(txn.userId, totalToRefund, {
    category: 'refund',
    status: 'success',
    reference: generateReference('refund'),
    metadata: {
      originalTxnId: txnId,
      reason,
      processedBy: adminId,
    },
  });

  // Mark original as reversed
  await ref.update({
    status: 'reversed',
    adminNote: reason,
    refundTxnId,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog({
    adminId,
    action: 'transaction:refund',
    resource: 'transactions',
    targetId: txnId,
    before: { status: txn.status },
    after: { status: 'reversed', refundTxnId, reason },
    ip,
  });

  return { txnId, refundTxnId, amountKobo: totalToRefund };
}

function buildStats(txns: Transaction[]) {
  const totalVolume = txns.reduce((s, t) => s + (t.type === 'debit' ? t.amount : 0), 0);
  const successCount = txns.filter(t => t.status === 'success').length;
  const failedCount = txns.filter(t => t.status === 'failed').length;
  const pendingCount = txns.filter(t => t.status === 'pending').length;
  return { totalVolume, successCount, failedCount, pendingCount, total: txns.length };
}

async function enrichWithUserNames(txns: Transaction[]) {
  const uids = [...new Set(txns.map(t => t.userId).filter(Boolean))];
  if (!uids.length) return txns;

  // Batch read up to 30 users at a time (Firestore `in` limit)
  const userMap = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 30) {
    const batch = uids.slice(i, i + 30);
    const snaps = await adminDb
      .collection('users')
      .where('uid', 'in', batch)
      .select('uid', 'displayName', 'email')
      .get();
    snaps.docs.forEach(d => {
      const u = d.data();
      userMap.set(u.uid, u.displayName ?? u.email ?? u.uid);
    });
  }

  return txns.map(t => ({
    ...t,
    _userName: userMap.get(t.userId) ?? t.userId,
  }));
}