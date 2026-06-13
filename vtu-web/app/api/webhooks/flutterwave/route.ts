// vtu-web/app/api/webhooks/flutterwave/route.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #5 (idempotency)

// IMPORTS NEEDED:
// - NextResponse from next/server
// - parseRawBody from @/lib/utils/body
// - handleFlutterwaveWebhook from @/lib/flutterwave/webhooks
// - adminDb from @/lib/firebase/admin
// - logExternalCall from @/lib/utils/logger

// ─── ROUTE HANDLER ─────────────────────────────────────────────────────────────

// HANDLER: POST
// PURPOSE : Receive and process Flutterwave webhook events.
// REQUEST : raw HTTP body and headers from Flutterwave.
// RETURNS : JSON response with status success or error.
//
// STEPS:
//   1. Read raw request body and 'verif-hash' header.
//   2. Call handleFlutterwaveWebhook(rawBody, signature).
//   3. On success → return NextResponse.json({ success: true }).
//   4. On failure → log the error and return NextResponse.json({ success: false, error }).

export async function POST(request: Request) {
  // route implementation placeholder
}
