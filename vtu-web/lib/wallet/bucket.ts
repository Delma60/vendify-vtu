// vtu-web/lib/wallet/bucket.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - Timestamp from firebase-admin/firestore
// - Transaction type from @/types
// - generateReference from @/lib/utils/reference
// - sendBucketNotification from @/lib/notifications/transaction.ts

// ─── BUCKET MODELS ─────────────────────────────────────────────────────────────

// FUNCTION: createBucket(userId, bucketData)
// PURPOSE : Create a new usage bucket for data, airtime, or SMS resale/product bundles.
// PARAMS  : userId: string, bucketData: { type, units, expiresAt, metadata }
// RETURNS : Promise<string> — created bucket document ID.
// THROWS  : Error if user does not exist or bucket limits are invalid.
//
// STEPS:
//   1. Validate bucketData fields: type, units, expiresAt.
//   2. Prepare bucket document with createdAt, updatedAt, isActive.
//   3. Write buckets collection document under userId.
//   4. Return created bucket ID.

// FUNCTION: getBucket(bucketId)
// PURPOSE : Read bucket details and active status.
// PARAMS  : bucketId: string
// RETURNS : Promise<Bucket | null>
//
// STEPS:
//   1. Read buckets/{bucketId}.
//   2. Return bucket document if exists, otherwise null.

// ─── BUCKET DEBIT ──────────────────────────────────────────────────────────────

// FUNCTION: debitBucket(bucketId, units, txnData)
// PURPOSE : Deduct units from a bucket instead of wallet balance.
// PARAMS  :
//   - bucketId: string
//   - units: number — unit count or value depending on bucket type.
//   - txnData: Partial<Transaction>
// RETURNS : Promise<string>
// THROWS  : Error if bucket is missing, expired, inactive, or has insufficient units.
//
// STEPS:
//   1. Read buckets/{bucketId}.
//   2. Validate active status and expiry.
//   3. Validate units remaining >= units.
//   4. Update buckets/{bucketId} with remaining units and updatedAt.
//   5. Create a transaction record linking bucketId and units deducted.
//   6. Send bucket transaction notification asynchronously.
//   7. Return transaction ID.

// FUNCTION: debitBucket(bucketId, units, txnData)
// PURPOSE : Centralized bucket deduction logic for service bundles.
// RETURNS : Promise<string>