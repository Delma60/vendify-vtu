// vtu-web/lib/providers/config.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

import { adminDb } from '@/lib/firebase/admin';
import type { ProviderConfig, ServiceType } from '@/types/provider';

let _cache: ProviderConfig[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute — config rarely changes, but no deploy needed to update

async function loadAllProviders(): Promise<ProviderConfig[]> {
  if (_cache && Date.now() < _cacheExpiresAt) return _cache;

  const snap = await adminDb.collection('providers').get();
  _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ProviderConfig);
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return _cache;
}

export function invalidateProviderConfigCache(): void {
  _cache = null;
  _cacheExpiresAt = 0;
}

/** Get a single provider config by its implementation code (e.g. 'vtpass'). */
export async function getProviderConfig(code: string): Promise<ProviderConfig | null> {
  const all = await loadAllProviders();
  return all.find(p => p.code === code && p.isActive) ?? null;
}

export async function getProviderConfigById(id: string): Promise<ProviderConfig | null> {
  const snap = await adminDb.collection('providers').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ProviderConfig;
}

/** Get a provider config by its webhook identifier. */
export async function getProviderConfigByIdentifier(identifier: string): Promise<ProviderConfig | null> {
  const all = await loadAllProviders();
  return all.find(p => p.identifier === identifier) ?? null;
}

// Fetch by the unique document ID
export async function getProviderById(id: string): Promise<ProviderConfig | null> {
  const all = await loadAllProviders();
  return all.find(p => p.id === id) ?? null;
}

// Fetch by the webhook identifier (crucial for multiple instances of Adex)
export async function getProviderByIdentifier(identifier: string): Promise<ProviderConfig | null> {
  const all = await loadAllProviders();
  return all.find(p => p.identifier === identifier && p.isActive) ?? null;
}

/**
 * Active providers that support a given service, sorted by priority
 * (lower number = tried first). Providers without a priority for this
 * service are placed last.
 */
export async function listActiveProvidersForService(service: ServiceType): Promise<ProviderConfig[]> {
  const all = await loadAllProviders();

  return all
    .filter(p => p.isActive && p.services.includes(service))
    .sort((a, b) => (a.priority?.[service] ?? 999) - (b.priority?.[service] ?? 999));
}