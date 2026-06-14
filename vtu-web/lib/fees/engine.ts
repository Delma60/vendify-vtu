// vtu-web/lib/fees/engine.ts
// AGENTS.md RULES: #1 (kobo), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeeType = 'flat' | 'percentage' | 'none';

export interface ServiceFeeConfig {
  service: string;          // 'airtime' | 'data' | 'electricity' | 'cable' | 'sms' | 'exam_pin' | '*'
  feeType: FeeType;
  feeValue: number;         // kobo (flat) or % (percentage). 0 if none.
  minFeeKobo: number;       // floor for percentage fees (0 = no floor)
  maxFeeKobo: number;       // cap for percentage fees (0 = no cap)
  vatEnabled: boolean;      // whether VAT applies to the fee on this service
  vatRate: number;          // e.g. 0.075 for 7.5% — only used if vatEnabled
  isActive: boolean;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface FeeCalculationResult {
  service: string;
  transactionAmountKobo: number;
  platformFeeKobo: number;
  vatKobo: number;
  totalFeeKobo: number;           // platformFeeKobo + vatKobo
  totalChargeKobo: number;        // transactionAmountKobo + totalFeeKobo
  feeBreakdown: {
    type: FeeType;
    value: number;
    vatRate: number;
    vatEnabled: boolean;
  };
}

// ─── In-memory cache (1-min TTL to avoid hammering Firestore) ────────────────

let _cache: ServiceFeeConfig[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadFeeConfigs(): Promise<ServiceFeeConfig[]> {
  if (_cache && Date.now() < _cacheExpiresAt) return _cache;

  const snap = await adminDb
    .collection('service_fees')
    .where('isActive', '==', true)
    .get();

  _cache = snap.docs.map(d => d.data() as ServiceFeeConfig);
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return _cache;
}

function invalidateCache(): void {
  _cache = null;
  _cacheExpiresAt = 0;
}

// ─── LOOKUP ───────────────────────────────────────────────────────────────────

/**
 * Find the best-matching fee config for a service.
 * Exact service match > wildcard '*' > null.
 */
export async function getFeeConfigForService(
  service: string
): Promise<ServiceFeeConfig | null> {
  const configs = await loadFeeConfigs();
  return (
    configs.find(c => c.service === service) ??
    configs.find(c => c.service === '*') ??
    null
  );
}

/**
 * Return all fee configs (active) — for admin list and public fee preview.
 */
export async function listFeeConfigs(includeInactive = false): Promise<ServiceFeeConfig[]> {
  if (includeInactive) {
    const snap = await adminDb.collection('service_fees').orderBy('service').get();
    return snap.docs.map(d => ({ ...d.data(), service: d.id }) as ServiceFeeConfig);
  }
  return loadFeeConfigs();
}

// ─── CALCULATE ────────────────────────────────────────────────────────────────

/**
 * Compute the platform fee and VAT for a transaction amount.
 * All amounts in kobo. Returns a full breakdown.
 *
 * @param service   - transaction category (e.g. 'airtime')
 * @param amountKobo - the net transaction amount (before fees)
 */
export async function calculateFee(
  service: string,
  amountKobo: number
): Promise<FeeCalculationResult> {
  const config = await getFeeConfigForService(service);

  let platformFeeKobo = 0;

  if (config && config.feeType !== 'none') {
    if (config.feeType === 'flat') {
      platformFeeKobo = config.feeValue;
    } else if (config.feeType === 'percentage') {
      platformFeeKobo = Math.floor((amountKobo * config.feeValue) / 100);

      if (config.minFeeKobo > 0) {
        platformFeeKobo = Math.max(platformFeeKobo, config.minFeeKobo);
      }
      if (config.maxFeeKobo > 0) {
        platformFeeKobo = Math.min(platformFeeKobo, config.maxFeeKobo);
      }
    }
  }

  // VAT is applied to the platform fee only (per requirements)
  let vatKobo = 0;
  const vatRate = config?.vatEnabled ? (config.vatRate ?? 0) : 0;
  if (vatRate > 0 && platformFeeKobo > 0) {
    vatKobo = Math.floor(platformFeeKobo * vatRate);
  }

  const totalFeeKobo = platformFeeKobo + vatKobo;

  return {
    service,
    transactionAmountKobo: amountKobo,
    platformFeeKobo,
    vatKobo,
    totalFeeKobo,
    totalChargeKobo: amountKobo + totalFeeKobo,
    feeBreakdown: {
      type: config?.feeType ?? 'none',
      value: config?.feeValue ?? 0,
      vatRate,
      vatEnabled: config?.vatEnabled ?? false,
    },
  };
}

// ─── ADMIN CRUD ───────────────────────────────────────────────────────────────

const VALID_SERVICES = [
  'airtime', 'data', 'electricity', 'cable', 'exam_pin', 'sms',
  'wallet_fund', 'withdrawal', 'transfer', '*',
] as const;

export type ValidService = typeof VALID_SERVICES[number];

export interface UpsertFeeConfigInput {
  service: ValidService;
  feeType: FeeType;
  feeValue: number;
  minFeeKobo?: number;
  maxFeeKobo?: number;
  vatEnabled?: boolean;
  vatRate?: number;
  isActive?: boolean;
}

/**
 * Create or replace the fee config for a service.
 * Document ID = service name (makes lookups O(1) and prevents duplicates).
 */
export async function upsertFeeConfig(
  input: UpsertFeeConfigInput,
  adminId: string
): Promise<void> {
  // Validation
  if (!VALID_SERVICES.includes(input.service)) {
    throw new Error(`Invalid service: ${input.service}`);
  }
  if (input.feeType === 'percentage' && input.feeValue > 100) {
    throw new Error('Percentage fee cannot exceed 100%');
  }
  if (input.feeType === 'flat' && input.feeValue < 0) {
    throw new Error('Flat fee cannot be negative');
  }
  if ((input.vatRate ?? 0) > 1) {
    throw new Error('VAT rate must be a decimal (e.g. 0.075 for 7.5%)');
  }

  const ref = adminDb.collection('service_fees').doc(input.service);
  const existing = await ref.get();

  const doc: ServiceFeeConfig = {
    service: input.service,
    feeType: input.feeType,
    feeValue: input.feeValue,
    minFeeKobo: input.minFeeKobo ?? 0,
    maxFeeKobo: input.maxFeeKobo ?? 0,
    vatEnabled: input.vatEnabled ?? false,
    vatRate: input.vatRate ?? 0.075,
    isActive: input.isActive ?? true,
    updatedBy: adminId,
    updatedAt: Timestamp.now(),
  };

  await ref.set(doc, { merge: false });
  invalidateCache();

  // Audit log
  await adminDb.collection('audit_logs').add({
    adminId,
    action: existing.exists ? 'fee_config:update' : 'fee_config:create',
    resource: 'service_fees',
    targetId: input.service,
    before: existing.exists ? existing.data() : null,
    after: doc,
    ip: 'server',
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Soft-disable a fee config (sets isActive = false).
 * Does NOT delete — per AGENTS.md rule #8.
 */
export async function deactivateFeeConfig(
  service: string,
  adminId: string
): Promise<void> {
  const ref = adminDb.collection('service_fees').doc(service);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Fee config for '${service}' not found`);

  await ref.update({ isActive: false, updatedBy: adminId, updatedAt: Timestamp.now() });
  invalidateCache();

  await adminDb.collection('audit_logs').add({
    adminId,
    action: 'fee_config:deactivate',
    resource: 'service_fees',
    targetId: service,
    before: snap.data(),
    after: { isActive: false },
    ip: 'server',
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ─── FEE REVENUE ANALYTICS ────────────────────────────────────────────────────

export interface FeeRevenueResult {
  totalPlatformFeeKobo: number;
  totalVatKobo: number;
  totalFeeRevenueKobo: number;   // platform + vat
  byService: Array<{
    service: string;
    txnCount: number;
    totalFeeKobo: number;
  }>;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Aggregate fee revenue from the transactions collection.
 * Reads `fee` field (platform fee, already stored per AGENTS.md wallet ops).
 * VAT is re-derived from the config at query time.
 */
export async function getFeeRevenue(opts: {
  startDate?: Date;
  endDate?: Date;
  service?: string;
}): Promise<FeeRevenueResult> {
  const now = new Date();
  const startDate = opts.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = opts.endDate ?? now;

  let query = adminDb
    .collection('transactions')
    .where('type', '==', 'debit')
    .where('status', '==', 'success')
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate)) as FirebaseFirestore.Query;

  if (opts.service) {
    query = query.where('category', '==', opts.service);
  }

  const snap = await query.get();
  const feeConfigs = await loadFeeConfigs();

  const byServiceMap = new Map<string, { txnCount: number; totalFeeKobo: number }>();
  let totalPlatformFeeKobo = 0;
  let totalVatKobo = 0;

  for (const doc of snap.docs) {
    const txn = doc.data() as { category: string; fee: number; amount: number };
    const feeKobo = txn.fee ?? 0;
    if (feeKobo <= 0) continue;

    const service = txn.category;
    const config =
      feeConfigs.find(c => c.service === service) ??
      feeConfigs.find(c => c.service === '*');

    const vatRate = config?.vatEnabled ? (config.vatRate ?? 0) : 0;
    const vatKobo = vatRate > 0 ? Math.floor(feeKobo * vatRate) : 0;

    totalPlatformFeeKobo += feeKobo;
    totalVatKobo += vatKobo;

    const entry = byServiceMap.get(service) ?? { txnCount: 0, totalFeeKobo: 0 };
    entry.txnCount++;
    entry.totalFeeKobo += feeKobo + vatKobo;
    byServiceMap.set(service, entry);
  }

  const byService = Array.from(byServiceMap.entries())
    .map(([service, data]) => ({ service, ...data }))
    .sort((a, b) => b.totalFeeKobo - a.totalFeeKobo);

  return {
    totalPlatformFeeKobo,
    totalVatKobo,
    totalFeeRevenueKobo: totalPlatformFeeKobo + totalVatKobo,
    byService,
    periodStart: startDate,
    periodEnd: endDate,
  };
}