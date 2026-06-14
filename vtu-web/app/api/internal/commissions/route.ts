// vtu-web/app/api/internal/commissions/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { getCommissionReport, settlePendingCommissions } from '@/lib/commissions/engine';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ok, err, parseIp } from '@/lib/utils/response';
import type { CommissionRate } from '@/lib/commissions/engine';

// ─── Validation schemas ───────────────────────────────────────────────────────

const CommissionRateSchema = z.object({
  service: z.string().min(1),
  type: z.enum(['percentage', 'flat']),
  level1: z.number().min(0),
  level2: z.number().min(0),
  level3: z.number().min(0),
  minTransactionAmount: z.number().int().min(0),
});

const UpdateRatesSchema = z.object({
  rates: z.array(CommissionRateSchema).min(1),
  // payoutThreshold in kobo — minimum pending balance before auto-settlement
  payoutThreshold: z.number().int().min(0).optional(),
});

const ReportQuerySchema = z.object({
  status: z.enum(['pending', 'credited', 'cancelled']).optional(),
  earnedByUserId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const ManualPayoutSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(50, 'Max 50 users per manual payout run'),
});

// ─── GET — view report or current rates config ────────────────────────────────

/**
 * GET /api/internal/commissions
 * GET /api/internal/commissions?view=rates  → current rates + threshold
 * GET /api/internal/commissions?view=stats  → aggregate totals across all users
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.FINANCE_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'report';

  // Return current rates + threshold config
  if (view === 'rates') {
    const snap = await adminDb.collection('system_settings').doc('commissions').get();
    const data = snap.exists
      ? (snap.data() as { rates?: CommissionRate[]; payoutThreshold?: number })
      : {};

    return ok({
      rates: data.rates ?? [],
      payoutThreshold: data.payoutThreshold ?? 50_000, // ₦500 default
    });
  }

  // Return aggregate stats across all users
  if (view === 'stats') {
    const [pendingSnap, creditedSnap, cancelledSnap] = await Promise.all([
      adminDb.collection('commissions').where('status', '==', 'pending').get(),
      adminDb.collection('commissions').where('status', '==', 'credited').get(),
      adminDb.collection('commissions').where('status', '==', 'cancelled').get(),
    ]);

    const sumKobo = (docs: FirebaseFirestore.QuerySnapshot) =>
      docs.docs.reduce((sum, d) => sum + (d.data().amount as number), 0);

    return ok({
      pendingCount: pendingSnap.size,
      pendingKobo: sumKobo(pendingSnap),
      creditedCount: creditedSnap.size,
      creditedKobo: sumKobo(creditedSnap),
      cancelledCount: cancelledSnap.size,
    });
  }

  // Return paginated commission report
  const parsed = ReportQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { status, earnedByUserId, startDate, endDate, page, pageSize } = parsed.data;

  const result = await getCommissionReport({
    status,
    earnedByUserId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page,
    pageSize,
  });

  const totalKobo = result.commissions.reduce((sum, c) => sum + c.amount, 0);

  return ok({
    commissions: result.commissions,
    hasMore: result.hasMore,
    totalKoboInPage: totalKobo,
  });
}

// ─── PUT — update commission rates and/or threshold ──────────────────────────

/**
 * PUT /api/internal/commissions
 * Update commission rates and payout threshold.
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.FINANCE_ADJUST);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateRatesSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { rates, payoutThreshold } = parsed.data;

  // Load current config for audit
  const currentSnap = await adminDb.collection('system_settings').doc('commissions').get();
  const before = currentSnap.exists ? currentSnap.data() : null;

  const update: Record<string, unknown> = {
    rates,
    updatedBy: ctx.uid,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payoutThreshold !== undefined) {
    update.payoutThreshold = payoutThreshold;
  }

  await adminDb.collection('system_settings').doc('commissions').set(update, { merge: true });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'commission_config:update',
    resource: 'system_settings',
    targetId: 'commissions',
    before,
    after: update,
    ip: parseIp(request),
  });

  return ok(
    { rates, payoutThreshold: payoutThreshold ?? (before as any)?.payoutThreshold ?? 50_000 },
    'Commission configuration updated successfully.'
  );
}

// ─── POST — manually trigger settlement for specific users ───────────────────

/**
 * POST /api/internal/commissions
 * Manually trigger immediate commission payout for a list of user IDs.
 * Bypasses the payout threshold. Useful for resolving support cases.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.FINANCE_ADJUST);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = ManualPayoutSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { userIds } = parsed.data;

  const summary = await settlePendingCommissions({
    bypassThreshold: true,
    userIds,
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'commission:manual_payout',
    resource: 'commissions',
    targetId: userIds.join(','),
    before: null,
    after: summary,
    ip: parseIp(request),
  });

  return ok(
    { ...summary, runAt: new Date().toISOString() },
    `Manual commission payout complete: ${summary.credited} records credited.`
  );
}