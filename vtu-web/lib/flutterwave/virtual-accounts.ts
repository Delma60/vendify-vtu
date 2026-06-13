// vtu-web/lib/flutterwave/virtual-accounts.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #14 (runtime config)

// IMPORTS NEEDED:
// - FlutterwaveClient from @/lib/flutterwave/client
// - env from @/lib/utils/env
// - logExternalCall from @/lib/utils/logger
// - VirtualAccount types from @/types

// ─── VIRTUAL ACCOUNT CLIENT ────────────────────────────────────────────────────

// FUNCTION: createVirtualAccount(userId, customerDetails)
// PURPOSE : Create a Flutterwave virtual account for a wallet top-up.
// PARAMS  :
//   - userId: string
//   - customerDetails: { email, phone, name }
// RETURNS : Promise<VirtualAccount>
// THROWS  : Error if Flutterwave request fails.
//
// STEPS:
//   1. Build payload with customer's email, phone, and metadata.
//   2. Call FlutterwaveClient.post('/v3/virtual-account-numbers', payload).
//   3. Map response to internal VirtualAccount shape.
//   4. Persist virtual account details in Firestore/storage if needed.
//   5. Return the virtual account record.

// FUNCTION: getVirtualAccountDetails(accountId)
// PURPOSE : Retrieve the latest Flutterwave virtual account details.
// PARAMS  : accountId: string
// RETURNS : Promise<VirtualAccount>
//
// STEPS:
//   1. Call FlutterwaveClient.get(`/v3/virtual-account-numbers/${accountId}`).
//   2. Map and return sanitized account details.

// FUNCTION: verifyVirtualAccountPayment(reference)
// PURPOSE : Verify a virtual account payment by reference.
// PARAMS  : reference: string
// RETURNS : Promise<PaymentVerificationResult>
//
// STEPS:
//   1. Call FlutterwaveClient.get(`/v3/virtual-account-transfers?reference=${reference}`).
//   2. Parse provider response and return normalized verification.
