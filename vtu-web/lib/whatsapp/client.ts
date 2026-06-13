// vtu-web/lib/whatsapp/client.ts
// AGENTS.md RULES: #9 (log every external call), #12 (staging separate), #14 (runtime config)

// IMPORTS NEEDED:
// - fetch from node-fetch
// - env from @/lib/utils/env
// - logExternalCall from @/lib/utils/logger
// - WhatsappMessageResponse from @/types

// ─── WHATSAPP CLIENT ───────────────────────────────────────────────────────────

// FUNCTION: sendWhatsAppMessage(to, template, variables)
// PURPOSE : Send a WhatsApp message via configured business API.
// PARAMS  : to: string, template: string, variables: Record<string,string>
// RETURNS : Promise<WhatsappMessageResponse>
//
// STEPS:
//   1. Build provider payload using WHATSAPP_API_TOKEN and PHONE_NUMBER_ID.
//   2. Send POST request to WhatsApp API endpoint.
//   3. Log request and response.
//   4. Return normalized provider response.

// FUNCTION: formatWhatsAppPayload(template, variables)
// PURPOSE : Convert template and variables into API payload.
// RETURNS : object
//
// STEPS:
//   1. Map variables to API field format.
//   2. Return complete request body.
