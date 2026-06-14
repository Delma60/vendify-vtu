# VTU Platform — Master TODO

> A production-grade, API-first VTU (Value Top-Up) business platform built with Next.js 14 (App Router) + TypeScript, Firebase, Flutterwave, and shadcn/ui. The Expo mobile app is a **standalone separate project** that consumes the same REST API. Designed to compete and beat existing Nigerian VTU platforms.

---

## PHASE 0 — Project Scaffolding & Architecture

### Web (Next.js) Project
 - [x] Initialize Next.js 14+ project (App Router) with TypeScript
 - [x] Configure Tailwind CSS + shadcn/ui component library
- [ ] Set up Firebase project (Firestore, Auth, Storage, Functions, Realtime DB)
 - [x] Configure Firebase Admin SDK for server-side operations
- [ ] Set up environment variable structure (`.env.local`, `.env.example`)
- [x] Set up Nodemailer with SMTP (custom domain via Zoho / Mailgun / Postmark)
- [ ] Set up ESLint, Prettier, Husky pre-commit hooks
- [ ] Configure path aliases (`@/components`, `@/lib`, `@/hooks`, etc.)
- [ ] Set up Vercel deployment pipeline with preview environments
- [ ] Set up error monitoring (Sentry)
- [ ] Set up logging service (Axiom / Logtail)
 - [x] Create shared type definitions (`types/index.ts`)
- [ ] Create shared constants (`lib/constants.ts`)
- [ ] Configure CORS and security headers in `next.config.js`
 - [x] Set up rate limiting middleware (Upstash Redis + `@upstash/ratelimit`)
 - [x] Set up API response helper utilities
- [ ] Set up CI/CD pipeline (GitHub Actions: lint → test → build → deploy)
- [ ] Set up staging environment (separate Firebase project)
- [ ] Set up feature flags (Firestore-based config doc for toggling features without deploys)

### Expo (Mobile) Project — Standalone Repo
- [ ] Initialize Expo project (`expo-router` with TypeScript)
- [ ] Configure EAS Build for iOS + Android
- [ ] Set up shared API client library (published as local package or npm)
- [ ] Configure Expo environment variables (`.env` via `expo-constants`)
- [ ] Set up Expo Push Notifications + FCM integration
- [ ] Set up Biometric auth (fingerprint/FaceID via `expo-local-authentication`)
- [ ] Configure deep linking / universal links (for email verify, payment callbacks)
- [ ] Set up Sentry for Expo
- [ ] Configure app versioning + EAS OTA updates
- [ ] App version enforcement: force update if below minimum version
- [ ] Offline transaction queue (queue locally, submit on reconnect with confirmation)
- [ ] Onboarding screens (first-launch tutorial)
- [ ] App Store & Play Store asset preparation (screenshots, descriptions, icons)
- [ ] Separate bottom nav layout (Home, Services, History, Wallet, Profile)
- [ ] Floating quick top-up hero card / CTA to make the product feel ready to use immediately

---

## PHASE 1 — Authentication & User Management

### Auth
- [x] Firebase Auth registration and login via email/password
- [ ] Google OAuth integration
- [ ] Phone number OTP verification (Firebase Phone Auth)
- [x] JWT session management with signed session cookie
- [x] Middleware for protected routes (web + API)
- [x] 2FA via email OTP or TOTP (Google Authenticator)
- [x] Login attempt throttling & account lockout (5 attempts / 15 min)
- [x] Device/session tracking (store device fingerprint on login)
- [x] Security alert email on new device login

### Custom Role & Permission System
- [x] Design permission schema: flat list of permission strings (e.g. `users:read`, `transactions:refund`, `loans:approve`, `admin:impersonate`)
- [x] Create `roles` collection in Firestore to store dynamic role documents
- [ ] Seed default roles: `super_admin`, `admin`, `support_agent`, `finance_officer`, `reseller`, `api_user`, `customer`
- [ ] Admin UI: Create Role page (name, description, pick permissions)
- [ ] Admin UI: Edit Role page (add/remove permissions from existing role)
- [ ] Admin UI: Delete Role (guard against deleting assigned roles)
- [ ] Admin UI: Assign Role to User
- [x] Permission middleware: server-side check on admin/internal API routes
- [ ] Permission hook on client: `useHasPermission(...)`
- [ ] Audit log entry on every role creation/edit/assignment
- [ ] Roles UI and assignment flow fully dynamic without code deploy

### User Profiles
- [x] Registration flow with email verification
- [ ] Phone verification on registration
- [ ] Profile page (avatar, name, phone, address, NIN optional)
- [ ] KYC verification tier system
- [ ] BVN/NIN verification via Flutterwave Identity API
- [x] Referral code generation per user
- [ ] Referral tracking and reward system
- [x] Transaction PIN setup (separate from login password)
- [ ] PIN reset via OTP
- [ ] Contact/beneficiary book (save phone numbers, meter numbers, smartcard numbers with nicknames)
- [x] Spending limits (daily/weekly caps — user-set, or admin-enforced per KYC tier)
- [ ] Right to erasure — NDPR-compliant account deletion (anonymize PII, retain transaction records)

---

## PHASE 2 — Wallet & Payment System

### Flutterwave Integration
- [ ] Flutterwave SDK setup (`flutterwave-node-v3`)
- [ ] Virtual Account Number generation per user on registration (Flutterwave Dedicated NUBAN)
- [x] Webhook handler for Flutterwave events (`/api/webhooks/flutterwave`)
- [x] Webhook signature verification (check `verif-hash` header)
- [x] Processed webhook ID deduplication (store in Firestore to prevent double-credit)
- [ ] Auto wallet top-up on successful bank transfer confirmation
- [ ] Card payment for wallet funding
- [ ] USSD payment option
- [ ] Bank transfer tracking with reference codes

### Wallet System
- [ ] Multi-currency wallet (NGN primary)
- [x] Wallet balance stored in **kobo** (integer, never float)
- [ ] Wallet balance Firestore document with optimistic locking
- [x] Atomic Firestore transactions for all debit/credit operations
- [x] Transaction history with filtering (date range, type, status), pagination, export (CSV/PDF)
- [x] Wallet to wallet transfer between users
- [x] Withdrawal requests (to bank account via Flutterwave Transfer API)
- [ ] **Minimum withdrawal amount** (configurable in admin settings, e.g. ₦500)
- [ ] **Withdrawal fee** (flat or percentage, configurable per admin)
- [ ] Bank account management (add, verify via BVN, remove)
- [x] Low balance alerts (user-configurable threshold)
- [x] Wallet freeze / unfreeze by admin
- [x] Transaction receipt PDF download per transaction

---

## PHASE 3 — Business & Monetization

### Subscription Plans
- [ ] Plan schema: `free`, `basic`, `pro`, `enterprise` (names configurable by admin)
- [ ] Per-plan features: transaction limits, API access, bucket access, loan eligibility, rate discounts, white-label
- [ ] Per-plan pricing: monthly + annual billing (annual = 2 months free)
- [ ] Subscription purchase via wallet or card (Flutterwave)
- [ ] Subscription renewal reminders (7 days, 3 days, day-of)
- [ ] Grace period on expiry (3–7 days) before downgrading to free
- [ ] Admin UI: create/edit/delete plans
- [ ] Admin UI: manually assign/override plan per user
- [ ] Plan comparison page (public-facing)
- [ ] Prorate logic for mid-cycle upgrades

### Commission & Referral Structure
- [ ] Per-service commission rates (e.g. 0.5% on airtime, 1% on data, ₦50 flat on electricity)
- [ ] Multi-level commission: Level 1 (direct referral) = X%, Level 2 = Y%, Level 3 = Z%
- [x] Commission credited to wallet immediately after referred user's transaction completes
- [ ] Commission history dashboard (who earned from whom, which transaction)
- [ ] Commission payout threshold (minimum before withdrawal, configurable)
- [ ] Reseller chain commission: percentage of downline spend flows up the chain per level
- [ ] Admin UI: configure commission rates per service, per plan tier
- [ ] Commission report: total paid out, pending, per user breakdown

### Cashback Campaigns
- [x] Campaign creation: name, start/end date, cashback % or flat amount, target service, target user segment
- [x] User segment targeting: all users, KYC tier, subscription plan, new users only
- [ ] Per-campaign cap: max cashback per user, max total campaign budget
- [x] Cashback credited to wallet automatically after qualifying transaction
- [ ] Cashback transaction type in history (distinct from regular credit)
- [ ] Campaign analytics: total triggered, total paid, ROI estimate
- [ ] Stacking rule: define if cashback + coupon can stack or not

### Transaction Fees
- [ ] Per-service fee config (flat fee, percentage, or none)
- [ ] Fee displayed at checkout before confirmation
- [ ] Fee revenue tracked separately in analytics
- [ ] VAT/tax handling: 7.5% VAT on applicable fees, shown on receipts
- [ ] Monthly statement includes fee breakdown

---

## PHASE 4 — VTU Services

### Airtime
- [ ] Buy airtime for self or others
- [ ] Multi-network: MTN, Airtel, Glo, 9mobile
- [ ] **Airtime to Cash conversion** (reseller feature — user submits airtime, gets % back to wallet)
- [ ] Airtime-to-cash rate config per network (admin-managed)
- [ ] Airtime-to-cash request flow: submit → admin verify → credit wallet
- [ ] Scheduled/auto-recharge (trigger when line goes below threshold)
- [ ] Bulk airtime top-up (CSV upload, up to 1000 rows)
- [ ] International airtime top-up (Africa-wide where provider supports)

### Data
- [ ] Data bundle purchase (all networks)
- [ ] Data plan categories: SME, Gifting, Corporate, Direct
- [ ] Data balance checker (where API supports)
- [ ] Scheduled data renewal
- [ ] Bulk data purchase (CSV upload)
- [ ] Data gifting — buy for someone, deliver to their email with personalized message
- [ ] Data bucket system (see Phase 8)

### Electricity Bills
- [ ] PHCN/AEDC/IKEDC/EKEDC/EEDC/KEDCO meter lookup
- [ ] Prepaid & postpaid billing
- [ ] Token delivery via SMS + email
- [ ] Meter number validation before payment
- [ ] Electricity bill receipts (PDF)
- [ ] Bill split feature (split bill between two users)

### Cable TV
- [ ] DSTV, GOtv, Startimes subscription
- [ ] Smart card/IUC number lookup & verification
- [ ] Bouquet selection with pricing
- [ ] Renewal & addon support

### Internet Subscriptions
- [ ] Smile, Spectranet top-up
- [ ] Account number lookup

### Education / Exam Pins
- [ ] WAEC result checker pin
- [ ] NECO result checker pin
- [ ] JAMB profile creation, mock, transaction
- [ ] NABTEB pin
- [ ] Pin delivery: SMS, email, dashboard scratch-card display
- [ ] Admin alert when pin stock drops below 10 units
- [ ] Auto-restock trigger (notify admin or trigger provider restock API if available)

### Bulk SMS
- [ ] SMS composition UI (plain text + `{{name}}` personalization tags)
- [ ] Contact list upload (CSV)
- [ ] Sender ID management + NCC approval pending state
- [ ] DND number filtering option
- [ ] Scheduled SMS delivery
- [ ] Delivery report tracking per recipient
- [ ] SMS unit balance display
- [ ] Provider: Termii, Multitexter (admin can switch)

### Bill Payments
- [ ] Airtime corporate gifting
- [ ] Water bills (where API available)
- [ ] Betting wallet funding (Bet9ja, SportyBet, etc.)
- [ ] Gift cards (where supported)

---

## PHASE 5 — Provider / Vendor Integrations

### Bilal / ADE Developers VTU Platform
- [ ] API key configuration
- [ ] Service endpoint mapping (airtime, data, pins)
- [ ] Error code normalization to internal codes
- [ ] Response logging and debugging

### SimhostNG (`simhostng.com`)
- [ ] API authentication setup
- [ ] Data purchase endpoint
- [ ] Balance check endpoint
- [ ] Webhook/callback handling
- [ ] Network mapping normalization

### Ogdams / SMEHost (`simhosting.ogdams.ng`)
- [ ] API key & base URL configuration
- [ ] Service list sync
- [ ] Airtime endpoint
- [ ] Data endpoint
- [ ] Error handling and retry logic

### Provider Abstraction Layer
- [x] Create unified `VTUProvider` interface/class all providers must implement
- [x] Per-service provider routing config (e.g. airtime → Bilal, data → SimhostNG)
- [x] Automatic failover: if Provider A fails → try Provider B → alert admin
- [x] Provider health check cron job (every 5 min)
- [ ] Admin UI to toggle providers per service
- [ ] Cost price vs sell price tracking per provider

### Price Sync
- [ ] Per-provider flag in config: `supportsPricePullAPI: boolean`
- [ ] For providers with price API: cron job pulls latest prices every 6 hours, updates `service_config`
- [ ] If pulled cost price exceeds current selling price → flag alert to admin immediately (margin breach)
- [ ] For providers without price API: admin manually updates prices via admin panel
- [ ] Admin UI: price management table (service, provider, cost, selling price, margin %)
- [ ] Price change audit log (who changed what, when)
- [ ] Cache data plan lists in Firestore with 1-hour TTL to avoid hammering provider APIs

### Auto Fund Provider (Float Management)
- [ ] Per-provider float balance tracker (stored in Firestore, updated after each transaction)
- [ ] Per-provider low float threshold (configurable, e.g. ₦50,000)
- [ ] When float drops below threshold:
  - [ ] Send email + in-app alert to admin immediately
  - [ ] If auto-fund is enabled and a Flutterwave payout method is configured: auto-transfer top-up amount to provider
  - [ ] Log the auto-fund event with amount, time, provider
- [ ] Manual fund provider button in admin panel
- [ ] Float history log per provider

### Dead Letter Queue
- [ ] Transactions that failed all retry attempts (3x with exponential backoff) are written to `dead_letter_queue` collection
- [ ] Each DLQ entry contains: original transaction data, all error responses, timestamps, retry count
- [ ] Admin UI: DLQ dashboard — list all stuck transactions, full error detail, action buttons
- [ ] Admin actions on DLQ: Retry manually, Mark as Refunded, Escalate, Add note
- [ ] DLQ alert: email admin when a new entry is added
- [x] Automatic DLQ sweep: cron job every 30 min re-attempts DLQ entries during provider maintenance windows

---

## PHASE 6 — Events & Coupons

### Events
- [ ] Event creation (name, description, date, banner image, location/virtual)
- [ ] Event ticketing (free, paid tiers)
- [ ] QR code ticket generation
- [ ] Event registration with wallet deduction
- [ ] Ticket scanner page (for organizers)
- [ ] Event attendee list & export
- [ ] Event public listing page
- [ ] Organizer dashboard

### Coupons
- [ ] Coupon code generator (fixed amount, percentage, free service)
- [ ] Coupon scope: platform-wide, user-specific, service-specific
- [ ] Expiry date and usage limit
- [ ] Min purchase amount condition
- [ ] Single-use vs multi-use coupons
- [ ] Coupon stacking rule (can stack with cashback or not)
- [ ] Coupon analytics (used, remaining, revenue impact)
- [ ] Bulk coupon generation (for campaigns)
- [ ] Coupon redemption at checkout

---

## PHASE 7 — API for API Users (Resellers / Developers)

### API Management
- [ ] API key generation (live + test keys, prefixed `vp_live_` / `vp_test_`)
- [ ] API key rotation
- [ ] Per-key rate limiting (configurable per plan)
- [ ] API key scoping (read-only, full access, service-specific)
- [ ] API usage dashboard (calls made, success rate, spend, latency)
- [ ] API documentation page (OpenAPI spec auto-rendered)
- [ ] Sandbox environment with pre-loaded test credits and mock provider responses

### API Versioning Strategy
- [ ] All public endpoints live under `/api/v1/`
- [ ] Version header support: `API-Version: 2024-01-01` for date-based versioning
- [ ] Deprecation notice header on sunset routes: `Deprecation: true`, `Sunset: <date>`
- [ ] Changelog page with version history and migration guides
- [ ] At least 6-month deprecation window before removing any endpoint
- [ ] v2 scaffolding planned from day one (don't break v1 when v2 launches)

### API Endpoints to Expose
- [ ] `POST /api/v1/airtime`
- [ ] `POST /api/v1/data`
- [ ] `POST /api/v1/electricity`
- [ ] `POST /api/v1/cable`
- [ ] `POST /api/v1/exam-pin`
- [ ] `POST /api/v1/sms`
- [ ] `GET  /api/v1/balance`
- [ ] `GET  /api/v1/transactions`
- [ ] `GET  /api/v1/transactions/:reference`
- [ ] `GET  /api/v1/data-plans`
- [ ] `POST /api/v1/verify/meter`
- [ ] `POST /api/v1/verify/smartcard`
- [ ] `GET  /api/v1/networks`
- [ ] `POST /api/v1/webhook/register`
- [ ] `GET  /api/v1/bucket/balance`
- [ ] `POST /api/v1/airtime-to-cash` (reseller)

### Webhooks for API Users
- [ ] Webhook URL registration per event type
- [ ] Webhook delivery with 3x retry + exponential backoff
- [ ] Webhook delivery logs (status, response code, body)
- [ ] HMAC-SHA256 webhook signing (secret per API key)

### API Affiliate Program
- [ ] Affiliate link generation for developers who refer other API users
- [ ] Commission: X% of referred API user's monthly spend for 12 months
- [ ] Affiliate dashboard: referred users, their spend, earned commissions
- [ ] Payout: credited to affiliate's wallet monthly
- [ ] Affiliate terms & conditions acceptance flow
- [ ] Admin UI: view all affiliates, manually adjust commissions, disable affiliates

---

## PHASE 8 — Loan Logic

- [ ] Loan eligibility engine (account age, KYC tier, transaction volume, repayment history)
- [ ] Credit scoring system (0–100 internal score → maps to loan tier)
- [ ] Loan tiers: Nano (₦5k–₦20k), Micro (₦20k–₦100k), SME (₦100k–₦500k)
- [ ] Loan application flow (amount, purpose, repayment period)
- [ ] Admin loan approval/rejection workflow with maker-checker (two admin approvals for SME tier)
- [ ] Auto-deduction from wallet on repayment due date
- [ ] Loan interest calculation (flat rate or reducing balance, configurable)
- [ ] Overdue loan penalty logic
- [ ] Loan disbursement to wallet
- [ ] Loan history and repayment schedule dashboard
- [ ] Loan default escalation: freeze account, escalation email chain
- [ ] Guarantor system (optional for higher tiers)
- [ ] Repayment reminder: email + SMS 3 days before, 1 day before, day-of

---

## PHASE 9 — Data/Airtime Bucket System

- [ ] Bucket types: Data (GB), Airtime (₦ value), SMS (units)
- [ ] Bucket purchase page (network, size, price)
- [ ] Bucket balance tracking in Firestore (atomic deductions)
- [ ] Transactions deduct from bucket instead of wallet (for bucket owners)
- [ ] Bucket transfer between sub-accounts
- [ ] Low bucket alert (push + email at configurable threshold)
- [ ] Bucket top-up
- [ ] Bucket expiry (30/60/90 days, configurable)
- [ ] Bucket usage analytics (sold, remaining, revenue)
- [ ] Multi-network buckets (separate MTN, Airtel, Glo buckets)
- [ ] Admin bucket allocation (grant bucket directly to user)
- [ ] Bulk discount tiers (buy more GB = lower per-GB price)
- [ ] Bucket pricing: profit margin per bucket size configured in admin

---

## PHASE 10 — Admin Panel

### Core
- [ ] Admin dashboard: revenue, transactions, active users, provider status at a glance
- [ ] User management (search, view, suspend, KYC verify, assign role)
- [ ] Transaction management (view all, filter, export, investigate)
- [ ] Refund processing: manual one-by-one + **bulk refund tool** (select multiple failed txns → refund all)
- [ ] Failed transaction investigation: full provider request/response log per transaction
- [ ] Service pricing management (markup per service per network)
- [ ] Provider routing config UI
- [ ] Subscription plan management (create, edit, delete plans)
- [ ] Coupon management
- [ ] Event management
- [ ] Loan management (approve, reject, track repayments)
- [ ] Bulk SMS blast to users (system announcements by segment)
- [ ] Push notification broadcaster
- [ ] Audit log (all admin actions: who, what, when, before/after)
- [ ] Revenue reports (daily, weekly, monthly, per service breakdown, per plan)
- [ ] Commission payout reports
- [ ] Payout management (approve/reject withdrawal requests)
- [ ] Bank account management for platform payouts

### Custom Role Management
- [ ] Roles list page: name, permission count, user count, actions
- [ ] Create role: form with permission checklist grouped by category
- [ ] Edit role: toggle permissions on/off
- [ ] Delete role (guard: reassign users first)
- [ ] Assign role to user from user management page

### IP Blacklisting
- [ ] Admin UI: add IP to blacklist (manual entry or from fraud flag)
- [ ] Blacklist applies to: login, registration, and all API calls
- [ ] Blacklisted IPs receive generic `403 Forbidden` (no detail leaked)
- [ ] IP range support (CIDR notation, e.g. `196.44.0.0/16`)
- [ ] Blacklist audit log (who added the IP, reason, date)
- [ ] Auto-blacklist trigger: if same IP hits rate limit 5 times in 1 hour
- [ ] Whitelist (override blacklist for trusted IPs, e.g. office IP)

### Geo-Blocking
- [ ] Enable/disable per country using ISO country code
- [ ] Default: Nigeria allowed, all others configurable
- [ ] Geo-block applies to: web registration, API calls, login
- [ ] Admin UI: country toggle list
- [ ] VPN detection flag (optional — flag suspicious geo-jumps within same session)
- [ ] Geo-block bypass for admin accounts

### Fraud Scoring
- [x] Per-transaction fraud score (0–100) computed at time of transaction
- [x] Score factors: same number topped up >5x in 1 hour, large amount on new account, mismatched geo, velocity spike
- [x] Score thresholds: <30 = auto-approve, 30–70 = flag for review, >70 = auto-reject + alert
- [ ] Flagged transactions queue in admin (review, approve, reject, blacklist user)
- [ ] Fraud alert email to admin when score > 70
- [ ] Fraud score history per user (trend up = risk escalation)
- [ ] Admin can manually adjust a user's risk level (low/medium/high)

### Customer Support Tools
- [ ] Built-in support ticket system: user submits dispute/query from dashboard
- [ ] Ticket categories: failed transaction, refund request, KYC issue, account access, other
- [ ] Ticket assignment to support agents (by role/permission `support:handle`)
- [ ] Ticket SLA tracking: first response < 4 hours, resolution < 24 hours
- [ ] Ticket escalation if SLA breached (email supervisor)
- [ ] Admin impersonation: admin can view platform exactly as a specific user (read-only, all actions logged, requires `admin:impersonate` permission)
- [ ] Internal notes on tickets (not visible to user)
- [ ] Ticket status: open, in-progress, waiting-on-user, resolved, closed
- [ ] Ticket history per user

### Maintenance Mode
- [ ] Global maintenance toggle in admin settings
- [ ] Per-service maintenance toggle (e.g. take down airtime only)
- [ ] Maintenance banner: configurable message + estimated restoration time
- [ ] Maintenance mode: API returns `503 Service Unavailable` with JSON reason
- [ ] Whitelist specific IPs from maintenance (admin can still access)
- [ ] Scheduled maintenance: set start time + end time, auto-activates/deactivates
- [ ] Notify users before scheduled maintenance (email + in-app banner 30 min before)

### System Settings
- [ ] Minimum withdrawal amount (global config)
- [ ] Transaction fee per service (global config)
- [ ] Low balance alert threshold (global default)
- [ ] Max loan amount per tier
- [ ] Commission rates per service
- [ ] Referral bonus amounts
- [ ] VAT rate (7.5% toggle)
- [ ] Supported networks list
- [ ] Platform name, logo, support email (for white-label base config)

---

## PHASE 11 — User: Transaction Disputes

- [ ] Dispute submission form: transaction reference, issue type, description, optional screenshot upload
- [ ] Dispute types: "I was charged but service not delivered", "Wrong amount deducted", "Paid twice", "Other"
- [ ] Dispute auto-links to original transaction record
- [ ] Dispute status tracking for user: submitted → under review → resolved / rejected
- [ ] Dispute notification updates (email + in-app)
- [ ] Admin: dispute investigation view with full transaction log, provider response
- [ ] Admin: initiate refund directly from dispute page
- [ ] Dispute SLA: flag to admin if not resolved within 24 hours
- [ ] Dispute resolution history per user

---

## PHASE 12 — Spending Limits

- [ ] Per-user daily spending limit (set by user or enforced by admin based on KYC tier)
- [ ] Per-user weekly spending limit
- [ ] Per-service spending limit (e.g. max ₦50k/day on airtime)
- [ ] KYC tier enforcement: Tier 0 max ₦5k/day, Tier 1 max ₦50k/day, Tier 2 max ₦500k/day, Tier 3 unlimited
- [ ] Spending limit warning at 80% utilization (in-app + email)
- [ ] Spending limit reset at midnight daily / Monday weekly
- [ ] Admin can override spending limit per user
- [ ] API users: per-key daily spend limit

---

## PHASE 13 — Notifications System

- [ ] In-app notification bell (Firestore real-time listener)
- [ ] Email (Nodemailer): transaction success/failure, low balance, loan status, KYC, dispute updates, subscription renewal
- [ ] SMS (Termii): critical events only (large debit, failed login, OTP)
- [ ] Push notifications via FCM (all events, configurable)
- [ ] **WhatsApp Business API**: transaction alerts + support messages (preferred by most Nigerian users)
- [ ] **Telegram bot**: balance check, transaction alerts for API/business users
- [ ] Notification preferences page (toggle per channel per event type)
- [ ] Notification history page (last 90 days)
- [ ] Automated email sequences (drip):
  - [ ] Registered but never funded → email at 24h, 72h, 7 days
  - [ ] Funded but never transacted → email at 24h
  - [ ] Inactive 30 days → re-engagement email
- [ ] Monthly statement auto-email (1st of every month)

---

## PHASE 14 — Reseller / Sub-Account System

- [ ] Reseller account type with custom pricing markup per service
- [ ] Sub-reseller chain (reseller creates sub-resellers, up to N levels)
- [ ] Commission flows up chain per level (configurable rates)
- [ ] Reseller dashboard: downline stats, commission earned, sub-reseller list
- [ ] Reseller onboarding link (unique referral + auto-assign parent)
- [ ] Per-reseller service pricing override (admin can set custom price for specific reseller)
- [ ] Reseller wallet funded directly or by parent
- [ ] White-label mode: reseller uses custom domain + branding (via Vercel edge config)
- [ ] Reseller profit margin calculator tool

---

## PHASE 15 — Security & Compliance

- [x] Transaction PIN required for all financial operations (debit, withdrawal, transfer)
- [ ] IP whitelisting per API key
- [ ] Anti-fraud rules engine (velocity checks, duplicate detection, geo anomaly)
- [x] Fraud scoring per transaction (see Phase 10)
- [ ] PCI-DSS awareness (no card data stored — all via Flutterwave)
- [ ] NIN/BVN verification (Flutterwave Identity API)
- [ ] AML: transaction threshold alert (₦5M+ single txn, ₦10M+ daily aggregate)
- [ ] NDPR compliance: privacy policy versioning + user acceptance tracking
- [ ] NDPR: data deletion/anonymization on request
- [ ] Firestore security rules: no direct client writes to wallets/transactions collections
- [ ] HTTPS enforced, HSTS header
- [ ] Content Security Policy headers
- [x] Rate limiting on all public endpoints
- [ ] Webhook signature verification (both incoming and outgoing)
- [x] Idempotency keys on all purchase endpoints (prevent double-spend)
- [ ] Soft delete only (never hard-delete transactions, users, API keys)
- [ ] Database backup: Firestore export to GCS daily
- [ ] Firebase billing alerts (prevent unexpected cost spikes)
- [ ] Uptime monitoring (BetterUptime / UptimeRobot)

---

## PHASE 16 — Analytics & Business Intelligence

- [ ] Revenue dashboard (gross, net, per service, per plan tier)
- [ ] Transaction volume by service, network, time of day
- [ ] User acquisition funnel (registered → verified → funded → transacted)
- [ ] Referral performance (clicks, signups, conversions, revenue)
- [ ] Affiliate program analytics
- [ ] Provider cost vs revenue margin report
- [ ] Failed transaction rate by provider
- [ ] Coupon ROI tracking
- [ ] Cashback campaign performance
- [ ] Loan portfolio health (disbursed, repaid, defaulted)
- [ ] Bucket utilization analytics
- [ ] Churn analysis (users inactive > 30/60/90 days)
- [ ] Fraud report (flagged transactions, blacklisted IPs, blocked users)
- [ ] Export all reports to Excel/PDF

---

## PHASE 17 — Developer Docs & SDK

- [ ] Public API docs site (Mintlify or Docusaurus)
- [ ] OpenAPI 3.0 spec (`/api/openapi.json`)
- [ ] Postman collection auto-export
- [ ] Integration guides (Node.js, PHP, Python quickstarts)
- [ ] JavaScript/Node.js SDK (published to npm: `vendpro-js`)
- [ ] Changelog page (versioned API history)
- [ ] Status page (provider health, API uptime) — BetterUptime embed
- [ ] Sandbox environment guide

---

## PHASE 18 — Competitive Differentiators

- [ ] Loyalty points (earn per transaction, redeem for discounts or free services)
- [ ] Quick-action shortcuts on dashboard (pin favorite services)
- [ ] Virtual prepaid card issuing (Flutterwave Cards API)
- [ ] Gift & send (buy airtime/data as a gift, recipient gets email)
- [ ] Automated monthly statement email with spend breakdown
- [ ] Dark mode UI (web + Expo)
- [ ] Service SLA tracking (fulfillment time per provider, shown in admin)
- [ ] CBN VAS license renewal reminders