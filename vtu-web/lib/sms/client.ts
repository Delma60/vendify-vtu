// vtu-web/lib/sms/client.ts
// AGENTS.md RULES: #9 (log every external call), #12 (staging separate), #14 (runtime config)

// IMPORTS NEEDED:
// - fetch from node-fetch
// - env from @/lib/utils/env
// - logExternalCall from @/lib/utils/logger
// - SmsProviderResponse from @/types

// ─── SMS CLIENT ────────────────────────────────────────────────────────────────

// FUNCTION: sendSms(destination, message, senderId)
// PURPOSE : Send an SMS via configured provider.
// PARAMS  : destination: string, message: string, senderId?: string
// RETURNS : Promise<SmsProviderResponse>
//
// STEPS:
//   1. Build SMS payload using TERMII_API_KEY and TERMII_SENDER_ID.
//   2. Send POST request to SMS provider.
//   3. Log request and response with external call logger.
//   4. Return normalized response.

// FUNCTION: validatePhoneNumber(phone)
// PURPOSE : Normalize and validate phone number format.
// PARAMS  : phone: string
// RETURNS : string
//
// STEPS:
//   1. Normalize to international format.
//   2. Validate using regex or library.
//   3. Return normalized phone or throw error.
