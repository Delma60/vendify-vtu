// vtu-web/lib/ip/blacklist.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #12 (staging separate)

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { logExternalCall } from '@/lib/utils/logger';
import type { IpBlacklistEntry } from '@/types/fraud';

// ─── CIDR MATCHING ────────────────────────────────────────────────────────────

/**
 * Convert a CIDR range (e.g. "196.44.0.0/16") to a numeric [networkInt, maskInt] pair.
 * Only supports IPv4.
 */
function parseCidr(cidr: string): [number, number] | null {
  const [ipPart, prefixPart] = cidr.split('/');
  if (!ipPart || prefixPart === undefined) return null;

  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const networkInt = ipToInt(ipPart);
  if (networkInt === null) return null;

  const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return [(networkInt & maskInt) >>> 0, maskInt];
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;

  // If no slash — it's an exact IP match
  if (!cidr.includes('/')) return ip === cidr;

  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  const [networkInt, maskInt] = parsed;
  return ((ipInt & maskInt) >>> 0) === networkInt;
}

// ─── IS BLACKLISTED ───────────────────────────────────────────────────────────

/**
 * Check whether an IP address is globally blocked.
 * Matches both exact IPs and CIDR ranges stored in ip_blacklist collection.
 *
 * Fails open (returns false) on any Firestore error — a broken check must
 * never block legitimate traffic on its own.
 */
export async function isBlacklisted(ip: string | undefined): Promise<boolean> {
  if (!ip) return false;

  const normalizedIp = ip.trim();

  try {
    const snap = await adminDb
      .collection('ip_blacklist')
      .where('isActive', '==', true)
      .get();

    if (snap.empty) return false;

    for (const doc of snap.docs) {
      const entry = doc.data() as IpBlacklistEntry;
      if (ipMatchesCidr(normalizedIp, entry.ip)) {
        logExternalCall('ip:blacklist', 'isBlacklisted', { ip: normalizedIp }, { matched: entry.ip }, true);
        return true;
      }
    }

    return false;
  } catch (error) {
    logExternalCall('ip:blacklist', 'isBlacklisted', { ip: normalizedIp }, { error: (error as Error).message }, false);
    return false; // fail open
  }
}

// ─── ADD TO BLACKLIST ─────────────────────────────────────────────────────────

/**
 * Add a new IP or CIDR range to the blacklist.
 * Returns the created document ID.
 */
export async function addIpToBlacklist(
  ip: string,
  reason: string,
  addedBy: string
): Promise<string> {
  const normalizedIp = ip.trim();

  // Validate: must be a single IPv4 or a CIDR range
  const isValid = normalizedIp.includes('/')
    ? parseCidr(normalizedIp) !== null
    : ipToInt(normalizedIp) !== null;

  if (!isValid) {
    throw new Error(`Invalid IP or CIDR: "${normalizedIp}"`);
  }

  // Check for duplicate active entry
  const existing = await adminDb
    .collection('ip_blacklist')
    .where('ip', '==', normalizedIp)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty) {
    return existing.docs[0].id; // idempotent — return existing
  }

  const ref = adminDb.collection('ip_blacklist').doc();
  const entry: IpBlacklistEntry = {
    id:        ref.id,
    ip:        normalizedIp,
    reason,
    addedBy,
    isActive:  true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await ref.set(entry);

  logExternalCall('ip:blacklist', 'addIpToBlacklist', { ip: normalizedIp, reason, addedBy }, { id: ref.id }, true);

  return ref.id;
}

// ─── REMOVE FROM BLACKLIST ────────────────────────────────────────────────────

/**
 * Soft-deactivate a blacklist entry (never hard-delete — AGENTS.md rule #8).
 */
export async function removeIpFromBlacklist(
  entryId: string,
  removedBy: string
): Promise<void> {
  await adminDb.collection('ip_blacklist').doc(entryId).update({
    isActive:  false,
    updatedAt: Timestamp.now(),
    // Store who removed it in metadata — no extra field needed, log covers it
  });

  logExternalCall('ip:blacklist', 'removeIpFromBlacklist', { entryId, removedBy }, null, true);
}

// ─── AUTO-BLACKLIST (rate-limit trigger) ──────────────────────────────────────

/**
 * Called by rate-limit middleware when the same IP hits the limit 5 times in 1 hour.
 * Writes a system-generated blacklist entry.
 */
export async function autoBlacklistIp(ip: string): Promise<void> {
  await addIpToBlacklist(ip, 'Auto-blacklisted: exceeded rate limit 5x in 1 hour', 'system');
}