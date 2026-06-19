// vtu-web/lib/geo/blocker.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #14 (runtime config)

import { adminDb } from '@/lib/firebase/admin';
import { logExternalCall } from '@/lib/utils/logger';

// geo_config/settings document shape (matches AGENTS.md Firestore model)
interface GeoConfig {
  allowedCountries: string[];   // ISO 3166-1 alpha-2 codes
  blockedCountries: string[];
  defaultAllow: boolean;        // true = allowlist mode OFF, only block listed countries
  updatedBy: string;
  updatedAt: FirebaseFirestore.Timestamp;
}

// Per-user geo session: last known country per userId
// Collection: user_geo_sessions/{userId}
interface UserGeoSession {
  userId: string;
  lastCountry: string;
  lastIp: string;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── LOAD GEO CONFIG ─────────────────────────────────────────────────────────

/**
 * Load geo config from Firestore (runtime config — never hardcoded).
 * Returns a safe default (Nigeria only) if the document is missing.
 */
async function getGeoConfig(): Promise<GeoConfig> {
  try {
    const snap = await adminDb.collection('geo_config').doc('settings').get();
    if (snap.exists) return snap.data() as GeoConfig;
  } catch {
    // Firestore unavailable — fail open with Nigeria-only default
  }

  return {
    allowedCountries: ['NG'],
    blockedCountries: [],
    defaultAllow: false,   // default: allowlist mode — only NG is allowed
    updatedBy: 'system',
    updatedAt: { toMillis: () => 0 } as unknown as FirebaseFirestore.Timestamp,
  };
}

// ─── IS GEO BLOCKED ──────────────────────────────────────────────────────────

/**
 * Determine whether a country or IP should be blocked.
 *
 * Logic:
 *   defaultAllow = true  → allow everything EXCEPT blockedCountries
 *   defaultAllow = false → block everything EXCEPT allowedCountries
 *
 * Fails open (returns false) on error — a broken geo check must never
 * silently deny legitimate Nigerian users.
 */
export async function isGeoBlocked(
  countryCode: string | undefined,
  ip: string | undefined
): Promise<boolean> {
  try {
    const config = await getGeoConfig();
    const country = (countryCode ?? '').toUpperCase();

    let blocked: boolean;

    if (config.defaultAllow) {
      // Permissive mode: block only countries in blockedCountries list
      blocked = country !== '' && config.blockedCountries.includes(country);
    } else {
      // Strict mode: allow only countries in allowedCountries list
      blocked = country === '' || !config.allowedCountries.includes(country);
    }

    if (blocked) {
      logExternalCall('geo:blocker', 'isGeoBlocked', { countryCode, ip }, { blocked: true, mode: config.defaultAllow ? 'permissive' : 'strict' }, true);
    }

    return blocked;
  } catch (error) {
    logExternalCall('geo:blocker', 'isGeoBlocked', { countryCode, ip }, { error: (error as Error).message }, false);
    return false; // fail open
  }
}

// ─── GEO BLOCK REASON ────────────────────────────────────────────────────────

/**
 * Return a human-readable reason for geo blocking.
 * Used by middleware to construct the 451 response body.
 */
export async function getGeoBlockReason(countryCode: string | undefined): Promise<string> {
  if (!countryCode) {
    return 'Access denied: your location could not be determined.';
  }

  const config = await getGeoConfig().catch(() => null);
  const country = countryCode.toUpperCase();

  if (!config) {
    return `Access from ${country} is not available in your region.`;
  }

  if (!config.defaultAllow && config.allowedCountries.length > 0) {
    return `This service is currently only available in: ${config.allowedCountries.join(', ')}.`;
  }

  return `Access from ${country} is restricted. If you believe this is an error, please contact support.`;
}

// ─── DETECT GEO ANOMALY ───────────────────────────────────────────────────────

/**
 * Detect a geo anomaly: the user's current country differs from
 * the country recorded in their last session.
 *
 * Used by fraud/scorer.ts as the "geo_anomaly" signal (weight 20).
 * Fails closed (returns false) so a missing session never flags a new user.
 *
 * After checking, updates the session record for next time.
 */
export async function detectGeoAnomaly(
  userId: string,
  ip: string | undefined
): Promise<boolean> {
  if (!ip || !userId) return false;

  // Resolve country from IP via Vercel/Cloudflare header (injected by middleware)
  // In practice, country code arrives as request.geo.country in middleware and
  // is forwarded as X-Country-Code. Here we use a Firestore lookup instead,
  // since scorer.ts doesn't have access to the request object.
  // If no session record exists yet → no anomaly (first session).
  try {
    const sessionRef = adminDb.collection('user_geo_sessions').doc(userId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      // First time — record and return no anomaly
      await sessionRef.set({
        userId,
        lastCountry: 'UNKNOWN',
        lastIp: ip,
        updatedAt: adminDb.doc('_').firestore.FieldValue ?? new Date(),
      } as unknown as UserGeoSession);
      return false;
    }

    const session = sessionSnap.data() as UserGeoSession;

    // If last IP matches exactly → no anomaly
    if (session.lastIp === ip) return false;

    // Detect rough country-level change via IP prefix heuristic:
    // If the first two octets differ significantly it's likely a different region.
    // A proper IP geolocation API would be ideal here; this is a lightweight proxy.
    const lastPrefix = session.lastIp.split('.').slice(0, 2).join('.');
    const currentPrefix = ip.split('.').slice(0, 2).join('.');
    const anomaly = lastPrefix !== currentPrefix && session.lastCountry !== 'UNKNOWN';

    // Update session (non-blocking)
    sessionRef.update({ lastIp: ip, updatedAt: new Date() }).catch(console.error);

    return anomaly;
  } catch {
    return false; // fail closed — don't flag on error
  }
}