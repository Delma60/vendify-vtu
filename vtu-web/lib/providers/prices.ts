// vtu-web/lib/providers/prices.ts
// AGENTS.md RULES: #1 (kobo), #8 (never hard-delete), #9 (log), #13 (config from Firestore), #14 (runtime config)
//
// The service_config collection stores the canonical selling price for each
// service+network combination. It is the ONLY source the checkout uses —
// never hardcode prices (AGENTS.md rule #13).
//
// Layout of a service_config document:
//   ID: e.g. "airtime:mtn", "data:airtel:sme_500mb", "electricity:prepaid"
//   Fields: see ServicePriceConfig below.
//
// Price lifecycle:
//   1. Admin sets a selling price manually (or via price sync).
//   2. At checkout, calculateFee() reads fee from service_fees;
//      the service route reads the plan price from service_config / data_plans.
//   3. If a synced cost price > selling price, a margin_breach alert fires.

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { listActiveProvidersForService } from './config';
import { ProviderFactory } from './factory';
import { logExternalCall } from '@/lib/utils/logger';
import type { ServiceType } from '@/types/provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServicePriceConfig {
  id: string;               // Firestore document ID
  service: ServiceType | string;
  network: string | null;   // null for non-network services (electricity, cable)
  label: string;            // human-readable: "MTN Airtime", "DSTV Premium"
  costPriceKobo: number;    // what we pay the provider (0 = unknown / not synced)
  sellPriceKobo: number;    // what we charge the customer
  marginPercent: number;    // computed: (sell - cost) / sell * 100  (0 if cost unknown)
  marginBreached: boolean;  // true if cost > sell
  providerCode: string | null;  // which provider last synced this price
  lastSyncedAt: Timestamp | null;
  supportsPriceSync: boolean;   // whether the primary provider exposes a price API
  isActive: boolean;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface PriceSyncResult {
  service: string;
  network: string | null;
  providerCode: string;
  previousCostKobo: number;
  newCostKobo: number;
  sellPriceKobo: number;
  marginBreached: boolean;
  error: string | null;
}

export interface PriceSyncSummary {
  synced: number;
  skipped: number;
  breached: number;
  errors: number;
  results: PriceSyncResult[];
  ranAt: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache: ServicePriceConfig[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

export function invalidatePriceCache(): void {
  _cache = null;
  _cacheExpiresAt = 0;
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

export async function listServicePrices(
  opts: { service?: string; includeInactive?: boolean } = {}
): Promise<ServicePriceConfig[]> {
  if (!opts.service && !opts.includeInactive && _cache && Date.now() < _cacheExpiresAt) {
    return _cache;
  }

  let query = adminDb.collection('service_config') as FirebaseFirestore.Query;

  if (!opts.includeInactive) query = query.where('isActive', '==', true);
  if (opts.service) query = query.where('service', '==', opts.service);

  query = query.orderBy('service').orderBy('network');

  const snap = await query.get();
  const configs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ServicePriceConfig);

  if (!opts.service && !opts.includeInactive) {
    _cache = configs;
    _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  }

  return configs;
}

export async function getServicePrice(id: string): Promise<ServicePriceConfig | null> {
  const snap = await adminDb.collection('service_config').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ServicePriceConfig;
}

// ─── UPDATE SELLING PRICE ─────────────────────────────────────────────────────

export interface UpdatePriceInput {
  id: string;
  sellPriceKobo: number;
  adminId: string;
}

export async function updateSellPrice(input: UpdatePriceInput): Promise<ServicePriceConfig> {
  if (!Number.isInteger(input.sellPriceKobo) || input.sellPriceKobo < 0) {
    throw new Error('sellPriceKobo must be a non-negative integer');
  }

  const ref = adminDb.collection('service_config').doc(input.id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Service config '${input.id}' not found`);

  const current = snap.data() as ServicePriceConfig;
  const costKobo = current.costPriceKobo ?? 0;
  const marginPercent = input.sellPriceKobo > 0 && costKobo > 0
    ? Math.round(((input.sellPriceKobo - costKobo) / input.sellPriceKobo) * 100 * 10) / 10
    : 0;
  const marginBreached = costKobo > 0 && costKobo > input.sellPriceKobo;

  const update = {
    sellPriceKobo: input.sellPriceKobo,
    marginPercent,
    marginBreached,
    updatedBy: input.adminId,
    updatedAt: Timestamp.now(),
  };

  await ref.update(update);
  invalidatePriceCache();

  // Audit
  await adminDb.collection('audit_logs').add({
    adminId: input.adminId,
    action: 'service_price:update',
    resource: 'service_config',
    targetId: input.id,
    before: { sellPriceKobo: current.sellPriceKobo },
    after: { sellPriceKobo: input.sellPriceKobo },
    ip: 'server',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Alert if margin breached
  if (marginBreached) {
    await writePriceAlert(input.id, current.label, costKobo, input.sellPriceKobo);
  }

  return { ...current, ...update } as ServicePriceConfig;
}

// ─── BULK UPDATE ──────────────────────────────────────────────────────────────

export async function bulkUpdateSellPrices(
  updates: Array<{ id: string; sellPriceKobo: number }>,
  adminId: string
): Promise<{ updated: number; breached: number }> {
  let updated = 0;
  let breached = 0;

  // Process in batches of 10 to stay within Firestore limits
  const chunks = chunkArray(updates, 10);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async u => {
        const result = await updateSellPrice({ ...u, adminId });
        updated++;
        if (result.marginBreached) breached++;
      })
    );
  }

  return { updated, breached };
}

// ─── PRICE SYNC FROM PROVIDER ─────────────────────────────────────────────────

/**
 * Pull latest cost prices from providers that support a price API.
 * Updates costPriceKobo on each service_config document.
 * If cost > sell, sets marginBreached = true and alerts admin.
 *
 * service: optional filter (sync only one service type)
 */
export async function syncPricesFromProviders(
  opts: { service?: ServiceType; adminId?: string } = {}
): Promise<PriceSyncSummary> {
  const configs = await listServicePrices({ service: opts.service, includeInactive: false });
  const results: PriceSyncResult[] = [];
  let synced = 0, skipped = 0, breached = 0, errors = 0;

  for (const config of configs) {
    if (!config.supportsPriceSync) {
      skipped++;
      continue;
    }

    const service = config.service as ServiceType;
    const [primaryProvider] = await listActiveProvidersForService(service);

    if (!primaryProvider) {
      skipped++;
      continue;
    }

    let newCostKobo = 0;
    let providerError: string | null = null;

    try {
      const instance = ProviderFactory.make(primaryProvider);

      // Providers implement getDataPlans() for data prices; for airtime/electricity
      // the cost is typically the face value (no markup). We call getDataPlans()
      // when service === 'data' and try to match on network+plan.
      if (service === 'data' && config.network) {
        const plans = await instance.getDataPlans?.(config.network);
        if (plans) {
          // Match by providerPlanId stored on config
          const match = plans.find(
            (p: { id: string; price: number }) => p.id === (config as any).providerPlanId
          );
          if (match) newCostKobo = match.price;
        }
      }

      logExternalCall(
        primaryProvider.name,
        'price_sync',
        { service, network: config.network },
        { costKobo: newCostKobo },
        true
      );
    } catch (e) {
      providerError = (e as Error).message;
      errors++;

      results.push({
        service: config.service,
        network: config.network,
        providerCode: primaryProvider.code,
        previousCostKobo: config.costPriceKobo,
        newCostKobo: 0,
        sellPriceKobo: config.sellPriceKobo,
        marginBreached: false,
        error: providerError,
      });
      continue;
    }

    if (newCostKobo === 0) {
      skipped++;
      continue;
    }

    const marginBreachedNow = newCostKobo > config.sellPriceKobo;
    const marginPercent = config.sellPriceKobo > 0
      ? Math.round(((config.sellPriceKobo - newCostKobo) / config.sellPriceKobo) * 100 * 10) / 10
      : 0;

    await adminDb.collection('service_config').doc(config.id).update({
      costPriceKobo: newCostKobo,
      marginPercent,
      marginBreached: marginBreachedNow,
      providerCode: primaryProvider.code,
      lastSyncedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: opts.adminId ?? 'cron',
    });

    synced++;
    if (marginBreachedNow) {
      breached++;
      await writePriceAlert(config.id, config.label, newCostKobo, config.sellPriceKobo);
    }

    results.push({
      service: config.service,
      network: config.network,
      providerCode: primaryProvider.code,
      previousCostKobo: config.costPriceKobo,
      newCostKobo,
      sellPriceKobo: config.sellPriceKobo,
      marginBreached: marginBreachedNow,
      error: null,
    });
  }

  invalidatePriceCache();

  return {
    synced,
    skipped,
    breached,
    errors,
    results,
    ranAt: new Date().toISOString(),
  };
}

// ─── PRICE CHANGE LOG ─────────────────────────────────────────────────────────

export interface PriceChangeLogEntry {
  id: string;
  configId: string;
  label: string;
  service: string;
  network: string | null;
  previousSellKobo: number;
  newSellKobo: number;
  previousCostKobo: number;
  newCostKobo: number;
  changedBy: string;
  source: 'manual' | 'sync';
  createdAt: Timestamp;
}

export async function getPriceChangeLog(
  opts: { configId?: string; page?: number; pageSize?: number } = {}
): Promise<{ entries: PriceChangeLogEntry[]; hasMore: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 50);

  let query = adminDb
    .collection('price_change_log')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (opts.configId) query = query.where('configId', '==', opts.configId);

  const snap = await query.limit(pageSize + 1).offset((page - 1) * pageSize).get();
  const hasMore = snap.docs.length > pageSize;

  return {
    entries: snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() }) as PriceChangeLogEntry),
    hasMore,
  };
}

// ─── MARGIN BREACH ALERT ──────────────────────────────────────────────────────

async function writePriceAlert(
  configId: string,
  label: string,
  costKobo: number,
  sellKobo: number
): Promise<void> {
  try {
    await adminDb.collection('price_alerts').add({
      configId,
      label,
      costKobo,
      sellKobo,
      marginKobo: sellKobo - costKobo,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Email admin (best-effort, non-blocking)
    const { sendMail } = await import('@/lib/mail/client');
    const { koboToNaira } = await import('@/lib/utils/formatter');
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

    for (const email of adminEmails) {
      await sendMail({
        to: email,
        subject: `⚠️ Margin breach: ${label}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>⚠️ Margin Breach Alert</h2>
            <p>The cost price for <strong>${label}</strong> now exceeds your selling price.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
              <tr style="background:#fef2f2"><td style="padding:8px;color:#6b7280">Cost price</td>
                <td style="padding:8px;font-weight:600;color:#dc2626">${koboToNaira(costKobo)}</td></tr>
              <tr><td style="padding:8px;color:#6b7280">Selling price</td>
                <td style="padding:8px;font-weight:600">${koboToNaira(sellKobo)}</td></tr>
              <tr style="background:#fef2f2"><td style="padding:8px;color:#6b7280">Loss per transaction</td>
                <td style="padding:8px;font-weight:600;color:#dc2626">${koboToNaira(costKobo - sellKobo)}</td></tr>
            </table>
            <p>Update the selling price immediately to avoid losses.</p>
          </div>
        `,
        text: `Margin breach: ${label}. Cost: ${koboToNaira(costKobo)}, Sell: ${koboToNaira(sellKobo)}. Update prices now.`,
      }).catch(console.error);
    }
  } catch (e) {
    console.error('[price-alert]', e);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}