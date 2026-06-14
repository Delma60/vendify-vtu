// vtu-web/app/api/internal/fees/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #6 (server-side permission checks), #8 (never hard-delete)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import {
  listFeeConfigs,
  upsertFeeConfig,
  deactivateFeeConfig,
  getFeeRevenue,
} from '@/lib/fees/engine';
import { ok, err, parseIp } from '@/lib/utils/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_SERVICES = [
  'airtime', 'data', 'electricity', 'cable', 'internet', 'exam_pin', 'sms',
  'wallet_fund', 'withdrawal', 'transfer', '*',
] as const;

const UpsertFeeSchema = z.object({
  service: z.enum(VALID_SERVICES),
  feeType: z.enum(['flat', 'percentage', 'none']),
  feeValue: z.number().min(0),      // kobo (flat) or % (percentage)
  minFeeKobo: z.number().int().min(0).optional().default(0),
  maxFeeKobo: z.number().int().min(0).optional().default(0),
  vatEnabled: z.boolean().optional().default(false),
  vatRate: z.number().min(0).max(1).optional().default(0.075), // 0.075 = 7.5%
  isActive: z.boolean().optional().default(true),
}).refine(
  d => !(d.feeType === 'percentage' && d.feeValue > 100),
  { message: 'Percentage fee cannot exceed 100%', path: ['feeValue'] }
).refine(
  d => !(d.feeType === 'flat' && !Number.isInteger(d.feeValue)),
  { message: 'Flat fee must be a whole number (kobo)', path: ['feeValue'] }
);

const DeactivateSchema = z.object({
  service: z.enum(VALID_SERVICES),
});

const RevenueQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  service: z.string().optional(),
});

// ─── GET — list all fee configs + optional revenue summary ───────────────────

/**
 * GET /api/internal/fees
 * GET /api/internal/fees?view=revenue&startDate=...&endDate=...
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  if (view === 'revenue') {
    const parsed = RevenueQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const revenue = await getFeeRevenue({
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      service: parsed.data.service,
    });

    return ok({ revenue });
  }

  const includeInactive = searchParams.get('includeInactive') === 'true';
  const configs = await listFeeConfigs(includeInactive);

  return ok({ configs, count: configs.length });
}

// ─── POST — create or update a fee config ────────────────────────────────────

/**
 * POST /api/internal/fees
 * Upserts (creates or replaces) the fee config for a service.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpsertFeeSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    await upsertFeeConfig(parsed.data, ctx.uid);
  } catch (e: any) {
    return err(e.message, 400);
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'fee_config:upsert',
    resource: 'service_fees',
    targetId: parsed.data.service,
    after: parsed.data,
    ip: parseIp(request),
  });

  return ok(
    { service: parsed.data.service },
    `Fee config for '${parsed.data.service}' saved.`,
    201
  );
}

// ─── DELETE — soft-deactivate ─────────────────────────────────────────────────

/**
 * DELETE /api/internal/fees
 * Soft-deactivates a service fee config (isActive = false).
 * Never hard-deletes — AGENTS.md rule #8.
 */
export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = DeactivateSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    await deactivateFeeConfig(parsed.data.service, ctx.uid);
  } catch (e: any) {
    return err(e.message, 404);
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'fee_config:deactivate',
    resource: 'service_fees',
    targetId: parsed.data.service,
    ip: parseIp(request),
  });

  return ok({ service: parsed.data.service }, `Fee config for '${parsed.data.service}' deactivated.`);
}