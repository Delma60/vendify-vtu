// vtu-web/lib/cable/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CABLE_PROVIDERS = ['dstv', 'gotv', 'startimes'] as const;
export type CableProvider = typeof CABLE_PROVIDERS[number];

export const CABLE_PROVIDER_LABELS: Record<CableProvider, string> = {
  dstv: 'DStv',
  gotv: 'GOtv',
  startimes: 'StarTimes',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CableBouquet {
  id: string;
  provider: CableProvider;
  name: string;            // e.g. "Compact", "Asia Bouquet", "ExtraView"
  code: string;            // provider-specific bouquet/addon code
  priceKobo: number;
  validityDays: number;
  type: 'bouquet' | 'addon';
  description?: string;
  isActive: boolean;
  updatedAt: Timestamp;
}

export interface SmartCardVerificationResult {
  cardNumber: string;
  provider: CableProvider;
  customerName: string;
  status: 'active' | 'inactive' | 'unknown';
  currentBouquetCode: string | null;
  currentBouquetName: string | null;
  dueDate: string | null;
  renewalAmountKobo: number | null;
}

export interface CablePurchaseResult {
  success: boolean;
  provider: string;
  providerReference: string;
  error?: string;
  shouldRefund?: boolean;
}

export interface CablePurchaseParams {
  smartCardNumber: string;
  provider: CableProvider;
  bouquetCode: string;
  addonCodes?: string[];
  customerName: string;
  reference: string;
}

// ─── Smart card / IUC normalisation ───────────────────────────────────────────

export function normaliseSmartCardNumber(number: string): string {
  return number.replace(/[\s-]/g, '');
}

// ─── Smart card verification ──────────────────────────────────────────────────

/**
 * Verify a smart card / IUC number with the provider router before allowing
 * payment. Caches results for 10 minutes per (provider, card) to avoid
 * hammering the provider when the user toggles bouquets in the checkout UI.
 */
const _verifyCache = new Map<string, { result: SmartCardVerificationResult; expiresAt: number }>();
const VERIFY_CACHE_TTL_MS = 10 * 60 * 1000;

export async function verifySmartCard(
  cardNumber: string,
  provider: CableProvider
): Promise<SmartCardVerificationResult> {
  const normalised = normaliseSmartCardNumber(cardNumber);
  const cacheKey = `${provider}:${normalised}`;

  const cached = _verifyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const { verifySmartCard: providerVerifySmartCard } = await import('@/lib/providers/router');
  const info = (await providerVerifySmartCard(normalised, provider)) as Record<string, unknown>;

  const result: SmartCardVerificationResult = {
    cardNumber: normalised,
    provider,
    customerName: String(info.customerName ?? ''),
    status: (info.status as SmartCardVerificationResult['status']) ?? 'active',
    currentBouquetCode: (info.currentPlanCode as string) ?? null,
    currentBouquetName: (info.currentPlan as string) ?? null,
    dueDate: (info.dueDate as string) ?? null,
    renewalAmountKobo:
      typeof info.renewalAmountKobo === 'number' ? (info.renewalAmountKobo as number) : null,
  };

  _verifyCache.set(cacheKey, { result, expiresAt: Date.now() + VERIFY_CACHE_TTL_MS });
  return result;
}

export function invalidateSmartCardCache(cardNumber: string, provider: CableProvider): void {
  _verifyCache.delete(`${provider}:${normaliseSmartCardNumber(cardNumber)}`);
}

// ─── Bouquet / add-on catalogue ────────────────────────────────────────────────

/**
 * Bouquets and add-ons are stored in `cable_bouquets`, cached for 1 hour
 * per (provider, type) — same pattern as data plans.
 */
const _bouquetCache = new Map<string, { bouquets: CableBouquet[]; expiresAt: number }>();
const BOUQUET_CACHE_TTL_MS = 60 * 60 * 1000;

export async function listBouquets(
  provider: CableProvider,
  type?: 'bouquet' | 'addon'
): Promise<CableBouquet[]> {
  const cacheKey = `${provider}:${type ?? 'all'}`;
  const cached = _bouquetCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.bouquets;

  let query = adminDb
    .collection('cable_bouquets')
    .where('provider', '==', provider)
    .where('isActive', '==', true) as FirebaseFirestore.Query;

  if (type) query = query.where('type', '==', type);

  const snap = await query.orderBy('priceKobo', 'asc').get();
  const bouquets = snap.docs.map(d => ({ id: d.id, ...d.data() }) as CableBouquet);

  _bouquetCache.set(cacheKey, { bouquets, expiresAt: Date.now() + BOUQUET_CACHE_TTL_MS });
  return bouquets;
}

export async function getBouquetById(bouquetId: string): Promise<CableBouquet | null> {
  const snap = await adminDb.collection('cable_bouquets').doc(bouquetId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CableBouquet;
}

export function invalidateBouquetCache(): void {
  _bouquetCache.clear();
}

// ─── Purchase (provider call wrapper) ─────────────────────────────────────────

/**
 * Call the provider router to pay a cable subscription (bouquet + optional
 * add-ons in a single request). Wraps payCable() and normalises the response.
 */
export async function purchaseCable(params: CablePurchaseParams): Promise<CablePurchaseResult> {
  const { payCable } = await import('@/lib/providers/router');

  const result = await payCable({
    smartCardNumber: params.smartCardNumber,
    provider: params.provider,
    bouquetCode: params.bouquetCode,
    addonCodes: params.addonCodes ?? [],
    customerName: params.customerName,
    reference: params.reference,
  });

  return {
    success: result.success,
    provider: (result as { provider?: string }).provider ?? 'unknown',
    providerReference: result.providerReference ?? '',
    error: result.error,
    shouldRefund: result.shouldRefund,
  };
}

// ─── Confirmation delivery (email + SMS) ──────────────────────────────────────

/**
 * Notify the user that their cable subscription was renewed.
 * Non-blocking — caller should fire without awaiting in the request path.
 */
export async function deliverCableConfirmation(opts: {
  userId: string;
  provider: CableProvider;
  smartCardNumber: string;
  customerName: string;
  bouquetName: string;
  addonNames: string[];
  amountKobo: number;
  reference: string;
}): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(opts.userId).get();
  if (!userSnap.exists) return;

  const user = userSnap.data() as {
    email: string;
    displayName: string;
    phone: string;
    notifications: { email: boolean; sms: boolean };
  };

  const { koboToNaira } = await import('@/lib/utils/formatter');
  const providerLabel = CABLE_PROVIDER_LABELS[opts.provider];
  const amountStr = koboToNaira(opts.amountKobo);

  if (user.notifications?.email) {
    const { sendMail } = await import('@/lib/mail/client');

    await sendMail({
      to: user.email,
      subject: `${providerLabel} subscription renewed successfully ✅`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>${providerLabel} Subscription Successful</h2>
          <p>Hi ${user.displayName},</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Smart card / IUC</td><td style="padding:8px;font-weight:600">${opts.smartCardNumber}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Customer</td><td style="padding:8px">${opts.customerName}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Bouquet</td><td style="padding:8px">${opts.bouquetName}</td></tr>
            ${opts.addonNames.length ? `<tr><td style="padding:8px;color:#6b7280">Add-ons</td><td style="padding:8px">${opts.addonNames.join(', ')}</td></tr>` : ''}
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600">${amountStr}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Reference</td><td style="padding:8px;font-size:12px">${opts.reference}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px">Your decoder should update automatically within a few minutes. If it doesn't, restart the decoder or contact ${providerLabel} support.</p>
        </div>
      `,
      text: `${providerLabel} subscription for ${opts.smartCardNumber} (${opts.customerName}) renewed: ${opts.bouquetName}${opts.addonNames.length ? ' + ' + opts.addonNames.join(', ') : ''}. Amount: ${amountStr}. Ref: ${opts.reference}`,
    });
  }

  if (user.notifications?.sms && user.phone) {
    try {
      const { sendSms } = await import('@/lib/sms/client');
      const smsText = `${providerLabel} renewed: ${opts.bouquetName}${opts.addonNames.length ? ' +' + opts.addonNames.length + ' addon(s)' : ''}. Amt: ${amountStr}. Ref: ${opts.reference}`;
      if (typeof sendSms === 'function') await sendSms(user.phone, smsText);
    } catch (error) {
      console.error('[cable:sms-delivery]', opts.reference, error);
    }
  }
}