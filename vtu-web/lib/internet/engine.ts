// vtu-web/lib/internet/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

export const INTERNET_PROVIDERS = ['smile', 'spectranet'] as const;
export type InternetProvider = typeof INTERNET_PROVIDERS[number];

export const INTERNET_PROVIDER_LABELS: Record<InternetProvider, string> = {
  smile: 'Smile',
  spectranet: 'Spectranet',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InternetPlan {
  id: string;
  provider: InternetProvider;
  name: string;            // e.g. "10GB Monthly", "Unlimited Lite"
  dataLabel: string;       // e.g. "10GB", "Unlimited"
  validityDays: number;
  priceKobo: number;
  providerPlanId: string;
  isActive: boolean;
  updatedAt: Timestamp;
}

export interface InternetAccountVerificationResult {
  accountNumber: string;
  provider: InternetProvider;
  customerName: string;
  status: 'active' | 'inactive' | 'unknown';
  currentPlanName: string | null;
  expiryDate: string | null;
}

export interface InternetPurchaseResult {
  success: boolean;
  provider: string;
  providerReference: string;
  error?: string;
  shouldRefund?: boolean;
}

export interface InternetPurchaseParams {
  accountNumber: string;
  provider: InternetProvider;
  providerPlanId: string;
  customerName: string;
  reference: string;
}

// ─── Account number normalisation ─────────────────────────────────────────────

export function normaliseAccountNumber(number: string): string {
  return number.replace(/[\s-]/g, '');
}

// ─── Account verification ─────────────────────────────────────────────────────

/**
 * Verify a Smile/Spectranet account number with the provider router before
 * allowing payment. Cached for 10 minutes per (provider, account).
 */
const _verifyCache = new Map<string, { result: InternetAccountVerificationResult; expiresAt: number }>();
const VERIFY_CACHE_TTL_MS = 10 * 60 * 1000;

export async function verifyInternetAccount(
  accountNumber: string,
  provider: InternetProvider
): Promise<InternetAccountVerificationResult> {
  const normalised = normaliseAccountNumber(accountNumber);
  const cacheKey = `${provider}:${normalised}`;

  const cached = _verifyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const { verifyInternetAccount: providerVerifyAccount } = await import('@/lib/providers/router');
  const info = (await providerVerifyAccount(normalised, provider)) as Record<string, unknown>;

  const result: InternetAccountVerificationResult = {
    accountNumber: normalised,
    provider,
    customerName: String(info.customerName ?? ''),
    status: (info.status as InternetAccountVerificationResult['status']) ?? 'active',
    currentPlanName: (info.currentPlan as string) ?? null,
    expiryDate: (info.expiryDate as string) ?? null,
  };

  _verifyCache.set(cacheKey, { result, expiresAt: Date.now() + VERIFY_CACHE_TTL_MS });
  return result;
}

export function invalidateInternetVerifyCache(accountNumber: string, provider: InternetProvider): void {
  _verifyCache.delete(`${provider}:${normaliseAccountNumber(accountNumber)}`);
}

// ─── Plan catalogue ────────────────────────────────────────────────────────────

const _planCache = new Map<string, { plans: InternetPlan[]; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function listInternetPlans(provider: InternetProvider): Promise<InternetPlan[]> {
  const cached = _planCache.get(provider);
  if (cached && Date.now() < cached.expiresAt) return cached.plans;

  const snap = await adminDb
    .collection('internet_plans')
    .where('provider', '==', provider)
    .where('isActive', '==', true)
    .orderBy('priceKobo', 'asc')
    .get();

  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }) as InternetPlan);
  _planCache.set(provider, { plans, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
  return plans;
}

export async function getInternetPlanById(planId: string): Promise<InternetPlan | null> {
  const snap = await adminDb.collection('internet_plans').doc(planId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as InternetPlan;
}

export function invalidateInternetPlanCache(): void {
  _planCache.clear();
}

// ─── Purchase (provider call wrapper) ─────────────────────────────────────────

export async function purchaseInternet(params: InternetPurchaseParams): Promise<InternetPurchaseResult> {
  const { payInternet } = await import('@/lib/providers/router');

  const result = await payInternet({
    accountNumber: params.accountNumber,
    provider: params.provider,
    providerPlanId: params.providerPlanId,
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

export async function deliverInternetConfirmation(opts: {
  userId: string;
  provider: InternetProvider;
  accountNumber: string;
  customerName: string;
  planName: string;
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
  const providerLabel = INTERNET_PROVIDER_LABELS[opts.provider];
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
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Account number</td><td style="padding:8px;font-weight:600">${opts.accountNumber}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Customer</td><td style="padding:8px">${opts.customerName}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Plan</td><td style="padding:8px">${opts.planName}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600">${amountStr}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Reference</td><td style="padding:8px;font-size:12px">${opts.reference}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px">Your ${providerLabel} plan should activate within a few minutes. Restart your router if it hasn't updated after 10 minutes.</p>
        </div>
      `,
      text: `${providerLabel} subscription for ${opts.accountNumber} (${opts.customerName}) renewed: ${opts.planName}. Amount: ${amountStr}. Ref: ${opts.reference}`,
    });
  }

  if (user.notifications?.sms && user.phone) {
    try {
      const { sendSms } = await import('@/lib/sms/client');
      const smsText = `${providerLabel} renewed: ${opts.planName}. Amt: ${amountStr}. Ref: ${opts.reference}`;
      if (typeof sendSms === 'function') await sendSms(user.phone, smsText);
    } catch (error) {
      console.error('[internet:sms-delivery]', opts.reference, error);
    }
  }
}