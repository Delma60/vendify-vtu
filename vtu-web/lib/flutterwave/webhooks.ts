// vtu-web/lib/flutterwave/webhooks.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #12 (staging separate)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - verifyWebhookSignature from @/lib/flutterwave/client
// - sendTransactionNotification from @/lib/notifications/transaction.ts
// - processWalletCredit from @/lib/wallet/operations
// - logExternalCall from @/lib/utils/logger
// - FlutterwaveWebhookEvent types from @/types

// ─── WEBHOOK PROCESSING ────────────────────────────────────────────────────────

// FUNCTION: handleFlutterwaveWebhook(rawBody, signature)
// PURPOSE : Validate and process incoming Flutterwave webhook events.
// PARAMS  : rawBody: string, signature: string
// RETURNS : Promise<void>
// THROWS  : Error if validation fails or processing fails.
//
// STEPS:
//   1. Validate signature using verifyWebhookSignature.
//      → if invalid → throw Error('Invalid webhook signature').
//   2. Parse rawBody JSON to event payload.
//   3. Normalize event with provider fields.
//   4. Deduplicate on event id or payment reference.
//   5. If event is successful payment:
//         - call processWalletCredit(userId, amount, txnData).
//         - store processed webhook record.
//   6. If event is failed or disputed:
//         - update related transaction and notify user/admin.
//   7. Log processing result and return.

// FUNCTION: normalizeFlutterwaveWebhook(payload)
// PURPOSE : Convert provider payload into internal webhook event shape.
// RETURNS : FlutterwaveWebhookEvent
//
// STEPS:
//   1. Extract event name, status, reference, amount, currency, customer, and metadata.
//   2. Map provider-specific keys to consistent names.
//   3. Return normalized event.
