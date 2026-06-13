// vtu-web/lib/wallet/operations.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - FieldValue, Timestamp from firebase-admin/firestore
// - scoreTransaction from @/lib/fraud/scorer
// - triggerCommissions from @/lib/commissions/engine
// - triggerCashback from @/lib/cashback/engine
// - sendTransactionNotification from @/lib/notifications/transaction.ts
// - generateReference from @/lib/utils/reference
// - Transaction, Wallet, User types from @/types

// ─── CUSTOM ERRORS ────────────────────────────────────────────────────────────

// CLASS: InsufficientFundsError extends Error
//   - message: 'Insufficient wallet balance'
//   - code: 'INSUFFICIENT_FUNDS'

// CLASS: SpendingLimitError extends Error
//   - message: 'Daily/weekly spending limit exceeded'
//   - code: 'SPENDING_LIMIT_EXCEEDED'

// CLASS: FraudError extends Error
//   - message: 'Transaction blocked by fraud detection'
//   - code: 'FRAUD_BLOCKED'

// CLASS: IdempotencyError extends Error
//   - message: 'Duplicate transaction detected'
//   - code: 'DUPLICATE_TRANSACTION'
//   - existingTxnId: string

// ─── WALLET DEBIT ──────────────────────────────────────────────────────────────

// FUNCTION: debitWallet(userId, amount, txnData, idempotencyKey?)
// PURPOSE : Atomically debit a user wallet. Single source of truth for all debits.
// PARAMS  :
//   - userId: string
//   - amount: number — MUST be in kobo (integer). Never float.
//   - txnData: Partial<Transaction> — metadata, category, provider info.
//   - idempotencyKey?: string — client-provided to prevent duplicate debits.
// RETURNS : Promise<string> — the created transaction document ID.
// THROWS  : InsufficientFundsError | SpendingLimitError | FraudError | IdempotencyError
//
// STEPS:
//   1. IDEMPOTENCY CHECK:
//      - If idempotencyKey provided:
//          query transactions where userId == userId AND idempotencyKey == key LIMIT 1
//          if found → return existingTxnId immediately to prevent double-spend.
//   2. RUN Firestore.runTransaction():
//      a. Read wallets/{userId} document.
//         → if missing → throw Error('Wallet not found').
//      b. Read users/{userId} document for spendingLimits and risk metadata.
//      c. Check daily/weekly spending limits:
//         → reset counters when lastResetDate is stale
//         → if amount + dailySpent > dailyLimit → throw SpendingLimitError
//         → if amount + weeklySpent > weeklyLimit → throw SpendingLimitError
//      d. Call scoreTransaction({ userId, amount, service: txnData.category, ip: txnData.metadata?.ip })
//         → if fraudScore > 70:
//              update user riskLevel to 'high'
//              throw FraudError
//         → if fraudScore >= 30:
//              flag transaction metadata for review but continue.
//      e. Check wallet.balance >= amount:
//         → if not → throw InsufficientFundsError
//      f. Compute balanceBefore and balanceAfter.
//      g. Update wallets/{userId}:
//           balance = balanceAfter
//           totalSpent = totalSpent + amount
//           updatedAt = Timestamp.now()
//      h. Create transactions/{generatedId} with debit details,
//           including category, amount, fee, balanceBefore, balanceAfter,
//           provider metadata, fraudScore, idempotencyKey, createdAt.
//   3. After transaction commits:
//      - triggerCommissions(userId, transactionId) asynchronously.
//      - triggerCashback(userId, transactionId) asynchronously.
//      - sendTransactionNotification(userId, transactionId) asynchronously.
//   4. Return the created transaction ID.

// FUNCTION: debitWallet(userId, amount, txnData, idempotencyKey?)
// PURPOSE : Single source of truth for all wallet debit operations.
// RETURNS : Promise<string>

// ─── WALLET CREDIT ─────────────────────────────────────────────────────────────

// FUNCTION: creditWallet(userId, amount, txnData)
// PURPOSE : Credit a user wallet for fund adds, refunds, cashback, or commission.
// PARAMS  :
//   - userId: string
//   - amount: number — MUST be in kobo (integer). Never float.
//   - txnData: Partial<Transaction>
// RETURNS : Promise<string> — the created transaction document ID.
// NOTE    : Credits do not require fraud scoring or PIN validation.
//
// STEPS:
//   1. Run Firestore.runTransaction():
//      a. Read wallets/{userId} document.
//         → if missing → throw Error('Wallet not found').
//      b. Compute balanceBefore and balanceAfter = balance + amount.
//      c. Update wallets/{userId}:
//           balance = balanceAfter
//           totalFunded = totalFunded + amount
//           updatedAt = Timestamp.now()
//      d. Create transactions/{generatedId} with credit details,
//           including type:'credit', amount, balanceBefore, balanceAfter,
//           provider metadata, createdAt.
//   2. Send credit notification asynchronously.
//   3. Return the created transaction ID.

// FUNCTION: creditWallet(userId, amount, txnData)
// PURPOSE : Single source of truth for all wallet credit operations.
// RETURNS : Promise<string>

// ─── BUCKET DEBIT ──────────────────────────────────────────────────────────────

// FUNCTION: debitBucket(bucketId, units, txnData)
// PURPOSE : Deduct units from a bucket instead of wallet balance.
// PARAMS  :
//   - bucketId: string — Firestore document ID in buckets collection.
//   - units: number — units to deduct (MB, NGN-value, or SMS count depending on bucket type).
//   - txnData: Partial<Transaction>
// RETURNS : Promise<string> — the created transaction document ID.
// THROWS  : Error if bucket has insufficient units or is expired.
//
// STEPS:
//   1. Read buckets/{bucketId}.
//      → if not found → throw Error('Bucket not found').
//   2. Verify bucket expiry and active status.
//      → if expired or inactive → throw Error('Bucket has expired or is inactive').
//   3. Verify units remaining >= units.
//      → if not → throw Error('Insufficient bucket units').
//   4. Compute unitsBefore and unitsAfter.
//   5. Update buckets/{bucketId} with remaining units and lastUsedAt.
//   6. Create transactions/{generatedId} with bucket debit details,
//         including bucketId, units, amount equivalent if applicable,
//         balanceBefore, balanceAfter, createdAt.
//   7. Return the created transaction ID.

// FUNCTION: debitBucket(bucketId, units, txnData)
// PURPOSE : Centralized bucket deduction logic for bundled services.
// RETURNS : Promise<string>
