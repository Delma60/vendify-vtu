// vtu-web/lib/fraud/signals.ts
// AGENTS.md RULES: #1 (kobo), #13 (config from Firestore)
//
// Individual fraud signal detectors used by lib/fraud/scorer.ts.
// Each function is read-only and should fail closed (return false) — a
// broken signal must never be able to block a legitimate transaction on its
// own. scorer.ts additionally wraps every call in .catch(() => false) as a
// second line of defence, but keep that invariant here too.

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// ─── Same phone number topped up repeatedly within a short window ────────────
// AGENTS.md signal: same_phone_5x_1hr (weight 30)

export async function checkVelocity(
  phone: string | undefined,
  times: number,
  windowMinutes: number
): Promise<boolean> {
  if (!phone) return false;

  const since = Timestamp.fromMillis(Date.now() - windowMinutes * 60_000);

  // NOTE: requires a composite index on (metadata.phone ASC, createdAt ASC)
  const snap = await adminDb
    .collection('transactions')
    .where('metadata.phone', '==', phone)
    .where('createdAt', '>=', since)
    .limit(times)
    .get();

  return snap.size >= times;
}

// ─── New account attempting an unusually large transaction ───────────────────
// AGENTS.md signal: new_account_large_tx (weight 25)

const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const LARGE_TX_THRESHOLD_KOBO = 2_000_000;          // ₦20,000

export async function checkNewAccountLarge(
  userId: string,
  amountKobo: number
): Promise<boolean> {
  if (amountKobo < LARGE_TX_THRESHOLD_KOBO) return false;

  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return false;

  const user = userSnap.data() as { createdAt?: Timestamp };
  if (!user.createdAt) return false;

  const accountAgeMs = Date.now() - user.createdAt.toMillis();
  return accountAgeMs < NEW_ACCOUNT_WINDOW_MS;
}

// ─── Sudden burst of debits from the same account ─────────────────────────────
// AGENTS.md signal: velocity_spike (weight 20)

const SPIKE_WINDOW_MINUTES = 10;
const SPIKE_THRESHOLD_COUNT = 4;

export async function checkSpike(userId: string): Promise<boolean> {
  const since = Timestamp.fromMillis(Date.now() - SPIKE_WINDOW_MINUTES * 60_000);

  const snap = await adminDb
    .collection('transactions')
    .where('userId', '==', userId)
    .where('type', '==', 'debit')
    .where('createdAt', '>=', since)
    .limit(SPIKE_THRESHOLD_COUNT)
    .get();

  return snap.size >= SPIKE_THRESHOLD_COUNT;
}

// ─── KYC tier mismatch — amount disproportionate to what the tier allows ─────
// AGENTS.md signal: kyc_tier_mismatch (weight 15)

const FALLBACK_KYC_DAILY_LIMITS: Record<0 | 1 | 2 | 3, number | null> = {
  0: 500_000,       // ₦5,000
  1: 5_000_000,     // ₦50,000
  2: 50_000_000,    // ₦500,000
  3: null,          // unlimited
};

// A single transaction eating this much of the tier's *whole daily allowance*
// in one shot is suspicious, even if it doesn't breach the limit outright.
const KYC_MISMATCH_RATIO = 0.8;

/**
 * Per AGENTS.md rule #13 — pulls the configured limit from
 * system_settings/global.defaultDailyLimitByKycTier first, falling back to
 * the hardcoded defaults (kept identical to lib/wallet/operations.ts) if
 * the doc or that tier's key is missing.
 */
export async function getKycDailyLimit(tier: 0 | 1 | 2 | 3): Promise<number | null> {
  if (tier === 3) return null; // unlimited, regardless of config

  const settingsSnap = await adminDb.collection('system_settings').doc('global').get();
  const configured = settingsSnap.exists
    ? (settingsSnap.data()?.defaultDailyLimitByKycTier as Record<string, number> | undefined)
    : undefined;

  if (configured && configured[String(tier)] !== undefined) return configured[String(tier)];
  return FALLBACK_KYC_DAILY_LIMITS[tier];
}

export async function checkKycMismatch(userId: string, amountKobo: number): Promise<boolean> {
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return false;

  const user = userSnap.data() as { kycTier?: 0 | 1 | 2 | 3 };
  const dailyLimit = await getKycDailyLimit(user.kycTier ?? 0);
  if (dailyLimit === null) return false; // unlimited tier — no mismatch possible

  return amountKobo >= dailyLimit * KYC_MISMATCH_RATIO;
}