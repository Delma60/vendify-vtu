// vtu-web/app/api/internal/providers/floats/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #6 (server-side permission checks), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requirePermission,
  handleAuthError,
  PERMISSIONS,
  writeAuditLog,
} from '@/lib/roles/middleware';
import {
  listProviderFloats,
  getFloatHistory,
  updateFloatSettings,
  syncProviderBalance,
  recordManualFund,
} from '@/lib/providers/float';
import { ok, err, parseIp } from '@/lib/utils/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const UpdateSettingsSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  lowThresholdKobo: z.number().int().min(0).optional(),
  autoFundEnabled: z.boolean().optional(),
  autoFundAmountKobo: z.number().int().min(0).optional(),
});

const ManualFundSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  amountKobo: z.number().int().positive('Amount must be greater than zero'),
  note: z.string().max(300).default('Manual top-up'),
});

const SyncSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
});

// ─── GET — list all floats + optional history for one provider ────────────────

/**
 * GET /api/internal/providers/floats
 * GET /api/internal/providers/floats?providerId=xxx        → include history
 * GET /api/internal/providers/floats?providerId=xxx&historyOnly=true
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');
  const historyOnly = searchParams.get('historyOnly') === 'true';

  if (providerId && historyOnly) {
    const history = await getFloatHistory(providerId, 50);
    return ok({ history });
  }

  const floats = await listProviderFloats();

  // Aggregate summary
  const totalBalanceKobo = floats.reduce((s, f) => s + f.balanceKobo, 0);
  const lowCount = floats.filter((f) => f.isLow && f.isActive).length;
  const autoFundCount = floats.filter((f) => f.autoFundEnabled && f.isActive).length;

  // If a specific provider is requested, also return its history
  let history = null;
  if (providerId) {
    history = await getFloatHistory(providerId, 20);
  }

  return ok({
    floats,
    summary: {
      totalBalanceKobo,
      lowCount,
      autoFundCount,
      totalProviders: floats.length,
      activeProviders: floats.filter((f) => f.isActive).length,
    },
    ...(history !== null ? { history } : {}),
  });
}

// ─── PUT — update float settings ─────────────────────────────────────────────

/**
 * PUT /api/internal/providers/floats
 * Body: { providerId, lowThresholdKobo?, autoFundEnabled?, autoFundAmountKobo? }
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateSettingsSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { providerId, ...updates } = parsed.data;

  try {
    await updateFloatSettings(providerId, updates, ctx.uid);
  } catch (e: any) {
    return err(e.message, 400);
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'provider_float:settings_update',
    resource: 'provider_floats',
    targetId: providerId,
    after: updates,
    ip: parseIp(request),
  });

  return ok({ providerId, updated: updates }, 'Float settings updated.');
}

// ─── POST — manual fund or sync ───────────────────────────────────────────────

/**
 * POST /api/internal/providers/floats
 * action = 'fund'  → record a manual top-up
 * action = 'sync'  → pull live balance from provider API
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_FUND);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const action: string = body?.action ?? 'fund';

  if (action === 'sync') {
    const parsed = SyncSchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const { providerId } = parsed.data;

    const result = await syncProviderBalance(providerId, ctx.uid);

    await writeAuditLog({
      adminId: ctx.uid,
      action: 'provider_float:sync',
      resource: 'provider_floats',
      targetId: providerId,
      after: { balanceKobo: result.balanceKobo, success: result.success },
      ip: parseIp(request),
    });

    if (!result.success) {
      return err(result.error ?? 'Could not retrieve balance from provider.', 502);
    }

    return ok(
      { providerId, balanceKobo: result.balanceKobo },
      `Balance synced: ₦${(result.balanceKobo / 100).toLocaleString('en-NG')}`
    );
  }

  // Default: record a manual fund
  const parsed = ManualFundSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { providerId, amountKobo, note } = parsed.data;

  try {
    await recordManualFund(providerId, amountKobo, note, ctx.uid);
  } catch (e: any) {
    return err(e.message, 400);
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'provider_float:manual_fund',
    resource: 'provider_floats',
    targetId: providerId,
    after: { amountKobo, note },
    ip: parseIp(request),
  });

  return ok(
    { providerId, amountKobo },
    `Recorded ₦${(amountKobo / 100).toLocaleString('en-NG')} top-up.`
  );
}