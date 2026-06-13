// vtu-web/lib/cashback/engine.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log every external call), #13 (config from Firestore)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - Transaction type from @/types
// - sendCashbackNotification from @/lib/notifications/cashback.ts
// - getActiveCashbackCampaigns from @/lib/cashback/campaigns.ts
// - logExternalCall from @/lib/utils/logger

// ─── CASHBACK ENGINE ──────────────────────────────────────────────────────────

// FUNCTION: calculateCashback(transaction)
// PURPOSE : Determine cashback amount based on active campaigns.
// PARAMS  : transaction: Transaction
// RETURNS : CashbackCalculationResult
//
// STEPS:
//   1. Load active cashback campaigns from Firestore.
//   2. Evaluate campaign eligibility using transaction.userId, service, amount, and plan.
//   3. Support percentage and flat cashback types.
//   4. Apply campaign caps and user maximums.
//   5. Return matched campaign and cashback amount.

// FUNCTION: triggerCashback(userId, transactionId)
// PURPOSE : Credit cashback for an eligible transaction.
// PARAMS  : userId: string, transactionId: string
// RETURNS : Promise<void>
//
// STEPS:
//   1. Read completed transaction details.
//   2. If transaction already has cashback or is ineligible, return.
//   3. Calculate cashback amount.
//   4. Write cashback record and optionally credit wallet.
//   5. Send cashback notification asynchronously.

// FUNCTION: settlePendingCashback()
// PURPOSE : Process queued cashback records that require later payout.
// RETURNS : Promise<void>
//
// STEPS:
//   1. Query pending cashback documents.
//   2. Validate each record still qualifies.
//   3. Create wallet credit transactions or update refund status.
//   4. Mark cashback records as paid.
