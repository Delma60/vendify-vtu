// vtu-web/lib/fraud/scorer.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #11 (test with emulator)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - isBlacklisted from @/lib/ip/blacklist
// - detectGeoAnomaly from @/lib/geo/blocker
// - Transaction type from @/types
// - logExternalCall from @/lib/utils/logger

// ─── FRAUD SCORING ENGINE ─────────────────────────────────────────────────────

// FUNCTION: scoreTransaction(params)
// PURPOSE : Compute a fraud score for a transaction across multiple risk signals.
// PARAMS  : { userId, amount, service, phone?, ip? }
// RETURNS : Promise<number> — 0-100 fraud score.
//
// STEPS:
//   1. Load user profile and recent transaction velocity.
//   2. Evaluate signal: ip_blacklisted.
//   3. Evaluate signal: same_phone_5x_1hr.
//   4. Evaluate signal: new_account_large_tx.
//   5. Evaluate signal: geo_anomaly.
//   6. Evaluate signal: velocity_spike.
//   7. Evaluate signal: kyc_tier_mismatch.
//   8. Sum weighted signals and cap at 100.
//   9. Return score.

// FUNCTION: isTransactionFlagged(score)
// PURPOSE : Determine whether transaction should be flagged or blocked.
// PARAMS  : score: number
// RETURNS : { blocked: boolean, review: boolean }
//
// STEPS:
//   1. If score > 70 → blocked.
//   2. If score >= 30 → review.
//   3. Otherwise → approved.
