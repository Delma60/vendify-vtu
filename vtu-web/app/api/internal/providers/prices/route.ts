// vtu-web/app/api/internal/providers/prices/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #6 (server-side permission checks), #8 (never hard-delete), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import {
  listServicePrices,
  updateSellPrice,
  bulkUpdateSellPrices,
  syncPricesFromProviders,
  getPriceChangeLog,
} from '@/lib/providers/prices';
import { ok, err, parseIp } from '@/lib/utils/response';
import type { ServiceType } from '@/types/provider';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_SERVICES = ['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'] as const;

const ListQuerySchema = z.object({
  service: z.enum(VALID_SERVICES).optional(),
  includeInactive: z.coerce.boolean().default(false),
  view: z.enum(['prices', 'log']).default('prices'),
  configId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const UpdateSingleSchema = z.object({
  id: z.string().min(1, 'Config ID is required'),
  sellPriceKobo: z
    .number()
    .int('Sell price must be in kobo (integer)')
    .min(0, 'Sell price cannot be negative'),
});

const BulkUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        sellPriceKobo: z.number().int().min(0),
      })
    )
    .min(1, 'At least one update required')
    .max(100, 'Max 100 updates per request'),
});

const SyncSchema = z.object({
  service: z.enum(VALID_SERVICES).optional(),
});

// ─── GET /api/internal/providers/prices ───────────────────────────────────────

/**
 * GET /api/internal/providers/prices                 → list all service price configs
 * GET /api/internal/providers/prices?service=data    → filter by service
 * GET /api/internal/providers/prices?view=log        → price change audit log
 * GET /api/internal/providers/prices?view=log&configId=xxx → log for a specific config
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.PROVIDERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { service, includeInactive, view, configId, page, pageSize } = parsed.data;

  if (view === 'log') {
    const { entries, hasMore } = await getPriceChangeLog({ configId, page, pageSize });
    return ok({ entries, pagination: { page, pageSize, hasMore } });
  }

  const configs = await listServicePrices({ service, includeInactive });

  // Aggregate summary for the header stats
  const summary = {
    total: configs.length,
    breached: configs.filter(c => c.marginBreached).length,
    noCostData: configs.filter(c => c.costPriceKobo === 0).length,
    syncEnabled: configs.filter(c => c.supportsPriceSync).length,
  };

  return ok({ configs, summary });
}

// ─── PUT /api/internal/providers/prices ───────────────────────────────────────

/**
 * PUT /api/internal/providers/prices
 * Body: { id, sellPriceKobo }           → update a single selling price
 * Body: { updates: [{ id, sellPriceKobo }] } → bulk update
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  if (!body) return err('Invalid JSON body', 400);

  // Detect bulk vs single
  if (Array.isArray(body.updates)) {
    const parsed = BulkUpdateSchema.safeParse(body);
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    try {
      const result = await bulkUpdateSellPrices(parsed.data.updates, ctx.uid);

      await writeAuditLog({
        adminId: ctx.uid,
        action: 'service_prices:bulk_update',
        resource: 'service_config',
        targetId: `bulk:${parsed.data.updates.length}`,
        after: { updated: result.updated, breached: result.breached },
        ip: parseIp(request),
      });

      return ok(
        result,
        `${result.updated} price${result.updated !== 1 ? 's' : ''} updated.${result.breached > 0 ? ` ⚠️ ${result.breached} margin breach${result.breached !== 1 ? 'es' : ''} detected.` : ''}`
      );
    } catch (e: any) {
      return err(e.message, 400);
    }
  }

  // Single update
  const parsed = UpdateSingleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    const updated = await updateSellPrice({ ...parsed.data, adminId: ctx.uid });

    await writeAuditLog({
      adminId: ctx.uid,
      action: 'service_price:update',
      resource: 'service_config',
      targetId: parsed.data.id,
      after: { sellPriceKobo: parsed.data.sellPriceKobo },
      ip: parseIp(request),
    });

    return ok(
      { config: updated },
      updated.marginBreached
        ? `Price updated. ⚠️ Margin breach: cost exceeds sell price.`
        : 'Price updated successfully.'
    );
  } catch (e: any) {
    return err(e.message, 404);
  }
}

// ─── POST /api/internal/providers/prices ──────────────────────────────────────

/**
 * POST /api/internal/providers/prices
 * Body: { service? }  → trigger price sync from providers
 *
 * Only syncs services where supportsPriceSync = true on the service_config doc
 * and where the primary provider implements getDataPlans().
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const summary = await syncPricesFromProviders({
    service: parsed.data.service as ServiceType | undefined,
    adminId: ctx.uid,
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'service_prices:sync',
    resource: 'service_config',
    targetId: parsed.data.service ?? 'all',
    after: {
      synced: summary.synced,
      breached: summary.breached,
      errors: summary.errors,
    },
    ip: parseIp(request),
  });

  const message = [
    `Sync complete: ${summary.synced} updated, ${summary.skipped} skipped.`,
    summary.breached > 0 ? `⚠️ ${summary.breached} margin breach${summary.breached !== 1 ? 'es' : ''} — check alerts.` : '',
    summary.errors > 0 ? `${summary.errors} error${summary.errors !== 1 ? 's' : ''}.` : '',
  ].filter(Boolean).join(' ');

  return ok({ summary }, message);
}