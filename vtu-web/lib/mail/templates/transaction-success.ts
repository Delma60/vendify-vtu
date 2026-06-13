// vtu-web/lib/mail/templates/transaction-success.ts
// AGENTS.md RULES: #9 (log every external call), #11 (test with emulator), #14 (runtime config)

// IMPORTS NEEDED:
// - Transaction type from @/types
// - formatCurrency from @/lib/utils/formatter
// - buildEmailTemplate from @/lib/mail/client

// ─── TRANSACTION SUCCESS TEMPLATE ─────────────────────────────────────────────

// FUNCTION: transactionSuccessTemplate(transaction, user)
// PURPOSE : Build HTML/text email content for successful transactions.
// PARAMS  : transaction: Transaction, user: User
// RETURNS : { subject: string, html: string, text: string }
//
// STEPS:
//   1. Format transaction amount and fees in NGN.
//   2. Include transaction reference, service, status, and date.
//   3. Add wallet balance summary and support contact.
//   4. Build subject line and return full email payload.
