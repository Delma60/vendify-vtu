// vtu-web/app/api/internal/commissions/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { getCommissionReport } from '@/lib/commissions/engine';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ok, err, parseIp } from '@/lib/utils/response';
import type { CommissionRate } from '@/lib/commissions/engine';

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
});

const ReportQuerySchema = z.object({
  status: z.enum(['pending', 'credited', 'cancelled']).optional(),
  earnedByUserId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/internal/commissions
 * Admin: view commission report + current rates config.
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

  // Return current rates config
  if (view === 'rates') {
    const snap = await adminDb.collection('system_settings').doc('commissions').get();
    const rates = snap.exists ? (snap.data() as { rates?: CommissionRate[] }).rates ?? [] : [];
    return ok({ rates });
  }

  // Return commission report
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

  // Aggregate totals from result set
  const totalKobo = result.commissions.reduce((sum, c) => sum + c.amount, 0);

  return ok({
    commissions: result.commissions,
    hasMore: result.hasMore,
    totalKoboInPage: totalKobo,
  });
}

/**
 * PUT /api/internal/commissions
 * Admin: update commission rates config.
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

  const { rates } = parsed.data;

  // Load current rates for audit
  const currentSnap = await adminDb.collection('system_settings').doc('commissions').get();
  const before = currentSnap.exists ? currentSnap.data() : null;

  await adminDb.collection('system_settings').doc('commissions').set({
    rates,
    updatedBy: ctx.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'commission_rates:update',
    resource: 'system_settings',
    targetId: 'commissions',
    before,
    after: { rates },
    ip: parseIp(request),
  });

  return ok({ rates }, 'Commission rates updated successfully.');
}