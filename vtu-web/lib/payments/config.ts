// vtu-web/lib/payments/config.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

import { adminDb } from '@/lib/firebase/admin';
import type { PaymentCapability, PaymentGatewayConfig } from '@/types/payment';

let _cache: PaymentGatewayConfig[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute — config rarely changes, but no deploy needed to update

async function loadAllGateways(): Promise<PaymentGatewayConfig[]> {
  if (_cache && Date.now() < _cacheExpiresAt) return _cache;

  const snap = await adminDb.collection('payment_gateways').get();
  _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PaymentGatewayConfig);
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return _cache;
}

export function invalidatePaymentConfigCache(): void {
  _cache = null;
  _cacheExpiresAt = 0;
}

/** Get a single gateway config by its implementation code (e.g. 'flutterwave'). */
export async function getPaymentGatewayConfig(code: string): Promise<PaymentGatewayConfig | null> {
  const all = await loadAllGateways();
  return all.find(g => g.code === code && g.isActive) ?? null;
}

export async function getPaymentGatewayConfigById(id: string): Promise<PaymentGatewayConfig | null> {
  const snap = await adminDb.collection('payment_gateways').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as PaymentGatewayConfig;
}

/** Get a gateway config by its webhook identifier (used by /api/webhooks/[identifier]). */
export async function getPaymentGatewayConfigByIdentifier(identifier: string): Promise<PaymentGatewayConfig | null> {
  const all = await loadAllGateways();
  return all.find(g => g.identifier === identifier) ?? null;
}

/**
 * Active gateways that support a given capability, sorted by priority
 * (lower number = tried first). Gateways without a priority for this
 * capability are placed last. Mirrors listActiveProvidersForService().
 */
export async function listActiveGatewaysForCapability(capability: PaymentCapability): Promise<PaymentGatewayConfig[]> {
  const all = await loadAllGateways();

  return all
    .filter(g => g.isActive && g.capabilities.includes(capability))
    .sort((a, b) => (a.priority?.[capability] ?? 999) - (b.priority?.[capability] ?? 999));
}

/** Convenience: the single highest-priority gateway for a capability, or null. */
export async function getPrimaryGatewayForCapability(capability: PaymentCapability): Promise<PaymentGatewayConfig | null> {
  const [first] = await listActiveGatewaysForCapability(capability);
  return first ?? null;
}