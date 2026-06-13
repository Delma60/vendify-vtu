// vtu-web/lib/mail/templates/low-balance.ts
// AGENTS.md RULES: #9 (log every external call), #11 (test with emulator), #14 (runtime config)

// IMPORTS NEEDED:
// - User type from @/types
// - formatCurrency from @/lib/utils/formatter
// - buildEmailTemplate from @/lib/mail/client

// ─── LOW BALANCE TEMPLATE ──────────────────────────────────────────────────────

// FUNCTION: lowBalanceTemplate(user, balance)
// PURPOSE : Build email content warning user of low wallet balance.
// PARAMS  : user: User, balance: number
// RETURNS : { subject: string, html: string, text: string }
//
// STEPS:
//   1. Format low balance in NGN using kobo values.
//   2. Include reason, call to action, and funding instructions.
//   3. Add support contact details and app name.
//   4. Return email payload.
