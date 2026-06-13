// vtu-web/lib/mail/templates/loan-approved.ts
// AGENTS.md RULES: #9 (log every external call), #11 (test with emulator), #14 (runtime config)

// IMPORTS NEEDED:
// - Loan type from @/types
// - formatCurrency from @/lib/utils/formatter
// - buildEmailTemplate from @/lib/mail/client

// ─── LOAN APPROVED TEMPLATE ───────────────────────────────────────────────────

// FUNCTION: loanApprovedTemplate(loan, user)
// PURPOSE : Build email content for approved loan disbursement.
// PARAMS  : loan: Loan, user: User
// RETURNS : { subject: string, html: string, text: string }
//
// STEPS:
//   1. Format loan amount, repayment schedule, and due date.
//   2. Include loan terms, next payment details, and support info.
//   3. Add link to loan dashboard and relevant cautionary notes.
//   4. Return email payload.
