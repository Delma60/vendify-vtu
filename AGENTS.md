# AGENT.md — VTU Platform Architecture & Implementation Guide

> Authoritative reference for every developer or AI agent working on this codebase. Read this before writing any code.

---

## Project Structure Overview

This platform consists of **two separate projects**:

| Project | Repo | Description |
|---------|------|-------------|
| `vtu-web` | `github.com/org/vtu-web` | Next.js 14 App Router — website, dashboard, admin panel, REST API |
| `vtu-mobile` | `github.com/org/vtu-mobile` | Expo React Native — standalone mobile app, consumes vtu-web REST API |

They share **no code directly**. The mobile app is a pure API consumer. Types can optionally be published as an npm package (`@org/vtu-types`) for sharing.

---

## Web Project (`vtu-web`) — Folder Structure

```
vtu-web/
├── app/
│   ├── (auth)/                   # login, register, verify-email, forgot-password
│   ├── (dashboard)/              # customer dashboard (wallet, services, history, profile)
│   ├── (admin)/                  # admin panel (role-guarded)
│   ├── (api-docs)/               # public-facing API documentation
│   ├── api/
│   │   ├── v1/                   # Public REST API (API users / Expo app)
│   │   │   ├── airtime/route.ts
│   │   │   ├── data/route.ts
│   │   │   ├── electricity/route.ts
│   │   │   ├── cable/route.ts
│   │   │   ├── exam-pin/route.ts
│   │   │   ├── sms/route.ts
│   │   │   ├── balance/route.ts
│   │   │   ├── transactions/route.ts
│   │   │   ├── data-plans/route.ts
│   │   │   ├── bucket/route.ts
│   │   │   ├── verify/
│   │   │   │   ├── meter/route.ts
│   │   │   │   └── smartcard/route.ts
│   │   │   └── webhook/route.ts
│   │   ├── webhooks/
│   │   │   └── flutterwave/route.ts
│   │   ├── auth/                 # next-auth or custom auth endpoints
│   │   └── internal/             # admin-only internal endpoints
│   └── layout.tsx
│
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── dashboard/
│   ├── admin/
│   ├── services/                 # per-service forms (airtime, data, etc.)
│   ├── wallet/
│   └── shared/
│
├── lib/
│   ├── firebase/
│   │   ├── admin.ts              # Firebase Admin SDK (server-side ONLY)
│   │   ├── client.ts             # Firebase client SDK (browser)
│   │   └── converters.ts
│   ├── flutterwave/
│   │   ├── client.ts
│   │   ├── virtual-accounts.ts
│   │   ├── webhooks.ts
│   │   └── payouts.ts
│   ├── providers/
│   │   ├── interface.ts          # VTUProvider abstract interface
│   │   ├── bilal.ts
│   │   ├── simhostng.ts
│   │   ├── ogdams.ts
│   │   └── router.ts             # routing + failover + dead letter
│   ├── wallet/
│   │   ├── operations.ts         # ALL wallet debit/credit (atomic)
│   │   └── bucket.ts
│   ├── loans/
│   │   └── engine.ts
│   ├── roles/
│   │   ├── permissions.ts        # permission string constants + groupings
│   │   └── middleware.ts         # requirePermission() server-side guard
│   ├── fraud/
│   │   └── scorer.ts             # per-transaction fraud scoring
│   ├── geo/
│   │   └── blocker.ts            # geo-block middleware
│   ├── ip/
│   │   └── blacklist.ts          # IP blacklist check
│   ├── sms/
│   │   └── client.ts
│   ├── whatsapp/
│   │   └── client.ts             # WhatsApp Business API
│   ├── mail/
│   │   ├── client.ts
│   │   └── templates/
│   ├── api/
│   │   ├── keys.ts               # API key generation + validation
│   │   └── rate-limit.ts
│   ├── subscriptions/
│   │   └── plans.ts              # plan enforcement, feature gating
│   ├── commissions/
│   │   └── engine.ts             # commission calculation + payout
│   ├── cashback/
│   │   └── engine.ts
│   ├── disputes/
│   │   └── handler.ts
│   └── utils/
│       ├── validators.ts         # Zod schemas
│       ├── formatter.ts          # currency (kobo ↔ NGN), dates
│       ├── reference.ts          # transaction reference generator
│       └── crypto.ts             # HMAC, token generation
│
├── hooks/
├── store/                        # Zustand global client state
├── types/
│   └── index.ts                  # all shared TypeScript types
├── middleware.ts                 # Next.js edge middleware (auth, geo, IP, maintenance)
├── public/
├── styles/
└── scripts/                      # seed, migration, one-off scripts
```

---

## Mobile Project (`vtu-mobile`) — Folder Structure

```
vtu-mobile/
├── app/                          # expo-router file-based routing
│   ├── (auth)/                   # login, register, onboarding
│   ├── (tabs)/                   # bottom tab navigator
│   │   ├── index.tsx             # Home / Dashboard
│   │   ├── services.tsx          # Services menu
│   │   ├── history.tsx           # Transaction history
│   │   ├── wallet.tsx            # Wallet, fund, withdraw
│   │   └── profile.tsx
│   └── _layout.tsx
├── components/
├── api/                          # API client (fetch wrappers for vtu-web v1 endpoints)
│   ├── client.ts                 # base fetcher with Bearer token injection
│   ├── airtime.ts
│   ├── data.ts
│   ├── wallet.ts
│   └── ...
├── hooks/
├── store/                        # Zustand (persisted with AsyncStorage)
├── constants/
│   └── env.ts                    # API base URL, app config from expo-constants
└── assets/
```

**Mobile ↔ Web contract:** The Expo app authenticates via the web API (`POST /api/auth/login` → returns JWT), stores token in SecureStore, sends `Authorization: Bearer <token>` on every request, and uses `X-Client: expo` header so the server can differentiate.

---

## Environment Variables

### `vtu-web/.env.local`
```env
# App
NEXT_PUBLIC_APP_URL=https://yourdomain.ng
NEXT_PUBLIC_APP_NAME=VendPro

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_ENCRYPTION_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

# VTU Providers
BILAL_API_KEY=
BILAL_BASE_URL=
SIMHOSTNG_API_KEY=
SIMHOSTNG_BASE_URL=
OGDAMS_API_KEY=
OGDAMS_BASE_URL=

# Nodemailer
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="VendPro <noreply@yourdomain.ng>"

# SMS (Termii)
TERMII_API_KEY=
TERMII_SENDER_ID=

# WhatsApp Business
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Upstash Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Internal Security
TRANSACTION_ENCRYPTION_KEY=
API_JWT_SECRET=
ADMIN_EMAILS=admin@yourdomain.ng
MAINTENANCE_BYPASS_IPS=
```

### `vtu-mobile/.env`
```env
EXPO_PUBLIC_API_BASE_URL=https://yourdomain.ng
EXPO_PUBLIC_APP_NAME=VendPro
EXPO_PUBLIC_SENTRY_DSN=
```

---

## Firestore Collections & Data Models

### `users`
```typescript
{
  uid: string,
  email: string,
  phone: string,
  displayName: string,
  avatar: string | null,
  roleId: string,                 // FK to roles/{roleId} — NOT hardcoded string
  kycTier: 0 | 1 | 2 | 3,
  referralCode: string,
  referredBy: string | null,
  isActive: boolean,
  isFrozen: boolean,
  transactionPin: string | null,  // bcrypt hashed
  subscriptionPlanId: string,     // FK to subscription_plans/{id}
  subscriptionExpiresAt: Timestamp | null,
  parentResellerId: string | null,
  resellerLevel: number,
  hasBucket: boolean,
  riskLevel: 'low' | 'medium' | 'high',
  spendingLimits: {
    dailyLimit: number | null,    // in kobo, null = use KYC tier default
    weeklyLimit: number | null,
    dailySpent: number,
    weeklySpent: number,
    lastResetDate: string,        // YYYY-MM-DD
  },
  notifications: {
    email: boolean,
    sms: boolean,
    push: boolean,
    whatsapp: boolean,
  },
  fcmTokens: string[],
  whatsappNumber: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `roles`
```typescript
// Fully dynamic — created and managed in admin panel
{
  id: string,
  name: string,                   // e.g. "Finance Officer", "Support Agent"
  description: string,
  permissions: string[],          // e.g. ['users:read', 'transactions:refund', 'loans:approve']
  isSystemRole: boolean,          // true = cannot be deleted (super_admin, customer)
  userCount: number,              // denormalized for display
  createdBy: string,              // admin userId
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**Permission string format:** `resource:action`

Permission groups and strings:
```
users:read, users:write, users:suspend, users:delete, users:impersonate
transactions:read, transactions:refund, transactions:export
loans:read, loans:approve, loans:reject
kyc:read, kyc:approve, kyc:reject
roles:read, roles:write, roles:delete, roles:assign
api_keys:read, api_keys:write
coupons:read, coupons:write
events:read, events:write
providers:read, providers:write, providers:fund
support:read, support:handle, support:escalate
finance:read, finance:withdraw, finance:adjust
system:settings, system:maintenance, system:audit
admin:impersonate
```

### `wallets`
```typescript
{
  userId: string,
  balance: number,                // ALWAYS in kobo (integer)
  currency: 'NGN',
  virtualAccountNumber: string,
  virtualAccountBank: string,
  virtualAccountRef: string,
  totalFunded: number,
  totalSpent: number,
  totalWithdrawn: number,
  lockedBalance: number,          // funds held for pending disputes
  updatedAt: Timestamp,
}
```

### `transactions`
```typescript
{
  id: string,
  userId: string,
  type: 'credit' | 'debit',
  category: 'airtime' | 'data' | 'electricity' | 'cable' | 'exam_pin' | 'sms'
          | 'wallet_fund' | 'withdrawal' | 'transfer' | 'bucket_purchase'
          | 'loan_disbursement' | 'loan_repayment' | 'event_ticket' | 'refund'
          | 'commission' | 'cashback' | 'fee' | 'airtime_to_cash',
  amount: number,                 // in kobo
  fee: number,                    // platform fee in kobo
  balanceBefore: number,
  balanceAfter: number,
  status: 'pending' | 'success' | 'failed' | 'reversed' | 'disputed',
  reference: string,              // internal (VTX-AIR-1718271234567-A7F3K2)
  providerReference: string | null,
  provider: string | null,
  metadata: Record<string, any>,  // phone, meter number, token, pins, etc.
  failureReason: string | null,
  retryCount: number,
  fraudScore: number,             // 0-100
  isApiTransaction: boolean,
  apiKeyId: string | null,
  idempotencyKey: string | null,  // client-provided to prevent double-spend
  receiptUrl: string | null,      // Firebase Storage URL to PDF receipt
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `api_keys`
```typescript
{
  id: string,
  userId: string,
  keyHash: string,                // SHA-256 of actual key (never store raw)
  keyPrefix: string,              // "vp_live_xxxx" (first 12 chars for display)
  label: string,
  environment: 'live' | 'test',
  scopes: string[],
  isActive: boolean,
  lastUsedAt: Timestamp | null,
  webhookUrl: string | null,
  webhookSecret: string | null,
  ipWhitelist: string[],
  dailySpendLimit: number | null, // in kobo
  rateLimit: number,              // requests per minute
  apiVersion: string,             // 'v1'
  createdAt: Timestamp,
}
```

### `subscription_plans`
```typescript
{
  id: string,
  name: string,                   // 'Free', 'Basic', 'Pro', 'Enterprise'
  description: string,
  monthlyPrice: number,           // in kobo
  annualPrice: number,            // in kobo (2 months free)
  features: {
    apiAccess: boolean,
    bucketAccess: boolean,
    loanAccess: boolean,
    whitelabelAccess: boolean,
    maxDailyTransactions: number | null,
    rateDiscount: number,         // percentage off standard rates
    prioritySupport: boolean,
    maxApiKeys: number,
  },
  isActive: boolean,
  displayOrder: number,
  createdAt: Timestamp,
}
```

### `commissions`
```typescript
{
  id: string,
  earnedByUserId: string,         // who earned
  sourceUserId: string,           // whose transaction triggered it
  transactionId: string,
  level: number,                  // 1 = direct referral, 2 = second tier, etc.
  amount: number,                 // in kobo
  rate: number,                   // % rate applied
  service: string,
  status: 'pending' | 'credited' | 'cancelled',
  creditedAt: Timestamp | null,
  createdAt: Timestamp,
}
```

### `cashback_campaigns`
```typescript
{
  id: string,
  name: string,
  type: 'percentage' | 'flat',
  value: number,
  targetService: string | null,   // null = all services
  targetSegment: 'all' | 'new_users' | 'plan:pro' | 'kyc:2',
  maxPerUser: number | null,      // max cashback amount per user in kobo
  totalBudget: number | null,     // max total payout in kobo
  totalPaidOut: number,
  startDate: Timestamp,
  endDate: Timestamp,
  stacksWithCoupons: boolean,
  isActive: boolean,
  createdBy: string,
  createdAt: Timestamp,
}
```

### `disputes`
```typescript
{
  id: string,
  userId: string,
  transactionId: string,
  type: 'not_delivered' | 'wrong_amount' | 'double_charge' | 'other',
  description: string,
  attachmentUrl: string | null,
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'rejected',
  assignedTo: string | null,      // support agent userId
  resolution: string | null,
  refundAmount: number | null,
  internalNotes: { authorId: string, text: string, createdAt: Timestamp }[],
  slaBreached: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `support_tickets`
```typescript
{
  id: string,
  userId: string,
  subject: string,
  category: 'transaction' | 'account' | 'kyc' | 'technical' | 'other',
  messages: {
    authorId: string,
    isInternal: boolean,
    text: string,
    createdAt: Timestamp,
  }[],
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed',
  assignedTo: string | null,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  slaBreached: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `provider_floats`
```typescript
{
  providerId: string,             // 'bilal' | 'simhostng' | 'ogdams'
  balance: number,                // in kobo (manually updated or via API)
  lowThreshold: number,           // alert when below this
  autoFundEnabled: boolean,
  autoFundAmount: number,         // how much to auto-top-up
  lastCheckedAt: Timestamp,
  lastFundedAt: Timestamp | null,
  updatedAt: Timestamp,
}
```

### `dead_letter_queue`
```typescript
{
  id: string,
  originalTransactionId: string,
  userId: string,
  service: string,
  amount: number,
  attempts: {
    provider: string,
    requestPayload: Record<string, any>,
    responseBody: Record<string, any>,
    errorCode: string,
    attemptedAt: Timestamp,
  }[],
  status: 'stuck' | 'manually_retried' | 'refunded' | 'resolved',
  adminNote: string | null,
  assignedTo: string | null,
  createdAt: Timestamp,
  resolvedAt: Timestamp | null,
}
```

### `ip_blacklist`
```typescript
{
  id: string,
  ip: string,                     // single IP or CIDR range
  reason: string,
  addedBy: string,                // admin userId or 'system'
  isActive: boolean,
  createdAt: Timestamp,
}
```

### `geo_config`
```typescript
// Single document: geo_config/settings
{
  allowedCountries: string[],     // ISO 3166-1 alpha-2 codes, e.g. ['NG']
  blockedCountries: string[],
  defaultAllow: boolean,          // if true, allow all except blockedCountries
  updatedBy: string,
  updatedAt: Timestamp,
}
```

### `system_settings`
```typescript
// Single document: system_settings/global
{
  maintenanceMode: boolean,
  maintenanceMessage: string,
  maintenanceEndsAt: Timestamp | null,
  maintenanceBypasIPs: string[],
  perServiceMaintenance: Record<string, boolean>,  // { airtime: false, data: true }
  minimumWithdrawalAmount: number,  // in kobo
  withdrawalFee: number,            // in kobo or percentage
  withdrawalFeeType: 'flat' | 'percentage',
  vatRate: number,                  // 0.075 = 7.5%
  vatEnabled: boolean,
  defaultDailyLimitByKycTier: Record<number, number>,  // { 0: 500000, 1: 5000000, 2: 50000000 }
  updatedBy: string,
  updatedAt: Timestamp,
}
```

---

## Custom Role & Permission System — Implementation

```typescript
// lib/roles/permissions.ts

export const PERMISSIONS = {
  // Users
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_SUSPEND: 'users:suspend',
  USERS_IMPERSONATE: 'users:impersonate',

  // Transactions
  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_REFUND: 'transactions:refund',

  // Loans
  LOANS_READ: 'loans:read',
  LOANS_APPROVE: 'loans:approve',

  // Roles
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_ASSIGN: 'roles:assign',

  // System
  SYSTEM_SETTINGS: 'system:settings',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  ADMIN_IMPERSONATE: 'admin:impersonate',

  // ... all others
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Permission groups for admin UI checklist display
export const PERMISSION_GROUPS = {
  'User Management': [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE, PERMISSIONS.USERS_SUSPEND, PERMISSIONS.USERS_IMPERSONATE],
  'Transactions': [PERMISSIONS.TRANSACTIONS_READ, PERMISSIONS.TRANSACTIONS_REFUND],
  'Loans': [PERMISSIONS.LOANS_READ, PERMISSIONS.LOANS_APPROVE],
  'Roles & Access': [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_WRITE, PERMISSIONS.ROLES_ASSIGN],
  'System': [PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.SYSTEM_MAINTENANCE, PERMISSIONS.ADMIN_IMPERSONATE],
};
```

```typescript
// lib/roles/middleware.ts

export async function requirePermission(
  request: Request,
  permission: Permission
): Promise<{ userId: string; roleId: string } | never> {
  // 1. Verify session token
  // 2. Load user from Firestore
  // 3. Load role from roles/{user.roleId}
  // 4. Check permission in role.permissions[]
  // 5. If missing: throw 403
  // 6. Log access attempt to audit log
}

// Usage in any API route:
// await requirePermission(request, PERMISSIONS.TRANSACTIONS_REFUND);
```

---

## VTU Provider Abstraction Layer

```typescript
// lib/providers/interface.ts
export interface VTUProvider {
  name: string;
  supportsPricePullAPI: boolean;   // determines if price sync cron pulls from this provider

  buyAirtime(params: AirtimeParams): Promise<VTUResponse>;
  buyData(params: DataParams): Promise<VTUResponse>;
  payElectricity(params: ElectricityParams): Promise<VTUResponse>;
  payCable(params: CableParams): Promise<VTUResponse>;
  buyExamPin(params: ExamPinParams): Promise<VTUResponse>;
  getDataPlans(network: string): Promise<DataPlan[]>;
  verifyMeter(meterNumber: string, disco: string, type: string): Promise<MeterInfo>;
  verifySmartCard(number: string, provider: string): Promise<SmartCardInfo>;
  getBalance(): Promise<number>;
  checkTransactionStatus(reference: string): Promise<VTUResponse>;
}

export interface VTUResponse {
  success: boolean;
  reference: string;
  providerReference: string;
  data?: any;
  error?: string;
  shouldRefund?: boolean;          // provider says money was NOT taken
}
```

### Provider Router Flow
```
1. Look up service_config for active primary + fallback provider
2. Check provider float balance — if too low, skip provider
3. Try primary provider (timeout: 30s)
4. If timeout or error → try fallback provider
5. If both fail:
   a. Write to dead_letter_queue
   b. Alert admin via email
   c. Return error to user
   d. Refund if provider confirmed charge was not made
6. Log every attempt (request, response, duration) in transaction.metadata
```

---

## Fraud Scoring Engine

```typescript
// lib/fraud/scorer.ts

interface FraudSignal {
  name: string;
  weight: number;        // how much it adds to score (0-100 total)
  detected: boolean;
}

async function scoreTransaction(params: {
  userId: string;
  amount: number;
  service: string;
  phone?: string;
  ip: string;
}): Promise<number> {
  const signals: FraudSignal[] = [
    { name: 'same_phone_5x_1hr',   weight: 30, detected: await checkVelocity(params.phone, 5, 60) },
    { name: 'new_account_large_tx', weight: 25, detected: await checkNewAccountLarge(params.userId, params.amount) },
    { name: 'ip_blacklisted',       weight: 100, detected: await isBlacklisted(params.ip) },
    { name: 'geo_anomaly',          weight: 20, detected: await detectGeoAnomaly(params.userId, params.ip) },
    { name: 'velocity_spike',       weight: 20, detected: await checkSpike(params.userId) },
    { name: 'kyc_tier_mismatch',    weight: 15, detected: await checkKycMismatch(params.userId, params.amount) },
  ];

  return Math.min(100, signals.filter(s => s.detected).reduce((sum, s) => sum + s.weight, 0));
}

// Thresholds:
// < 30  → auto-approve
// 30-70 → flag, process but add to review queue
// > 70  → auto-reject, alert admin, increment user risk level
```

---

## Maintenance Mode Middleware

```typescript
// middleware.ts (Next.js edge)

export async function middleware(request: NextRequest) {
  // 1. IP blacklist check (before anything else)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0];
  if (await isBlacklisted(ip)) return new Response('Forbidden', { status: 403 });

  // 2. Geo-block check
  const country = request.geo?.country;
  if (await isGeoBlocked(country, ip)) return new Response('Not available in your region', { status: 451 });

  // 3. Maintenance mode check
  const settings = await getSystemSettings();           // cached via edge KV
  if (settings.maintenanceMode && !isBypassIP(ip, settings.maintenanceBypasIPs)) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({
        error: 'Service temporarily unavailable',
        message: settings.maintenanceMessage,
        endsAt: settings.maintenanceEndsAt,
      }, { status: 503 });
    }
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  // 4. Per-service maintenance (for API routes only)
  const service = extractServiceFromPath(request.nextUrl.pathname);  // e.g. 'airtime'
  if (service && settings.perServiceMaintenance[service]) {
    return NextResponse.json({ error: `${service} service is temporarily unavailable` }, { status: 503 });
  }

  // 5. Auth guard for dashboard + admin routes
  // ...
}
```

---

## Admin Impersonation

```typescript
// Only available to users with 'admin:impersonate' permission
// All actions during impersonation are logged with both the admin's ID and the target user's ID

// How it works:
// 1. Admin clicks "Impersonate" on user management page
// 2. Server creates a short-lived impersonation token (15 min, stored in Firestore)
// 3. Admin's browser receives this token, sets it alongside their own session
// 4. All API calls include X-Impersonating: {targetUserId} header
// 5. Server reads their OWN session for permission check, but loads TARGET user's data
// 6. Every action is logged: { adminId, targetUserId, action, timestamp }
// 7. Impersonation session expires automatically or admin clicks "End Impersonation"
// 8. Financial actions (debit, withdrawal) are BLOCKED during impersonation
```

---

## Wallet Operations (Atomic — Mandatory Pattern)

```typescript
// lib/wallet/operations.ts
// ALL wallet changes go through these functions. Never write to wallets directly.

async function debitWallet(
  userId: string,
  amount: number,               // in kobo
  txnData: Partial<Transaction>,
  idempotencyKey?: string
): Promise<string>              // returns transaction ID

async function creditWallet(
  userId: string,
  amount: number,
  txnData: Partial<Transaction>
): Promise<string>

async function debitBucket(
  bucketId: string,
  units: number,
  txnData: Partial<Transaction>
): Promise<string>

// Inside debitWallet:
// 1. Check idempotencyKey — if already processed, return existing txn ID
// 2. Firestore.runTransaction():
//    a. Read wallet balance
//    b. Check spending limit for today/week
//    c. Run fraud score — if > 70, throw FraudError
//    d. If balance < amount → throw InsufficientFundsError
//    e. Write new balance (balance - amount)
//    f. Write transaction document
//    g. Update daily/weekly spend counter
// 3. Trigger commission engine async
// 4. Trigger cashback engine async
// 5. Send notification async
```

---

## Transaction Reference Format

```
VTX-{SERVICE_CODE}-{TIMESTAMP_MS}-{RANDOM_6}
```

| Service | Code |
|---------|------|
| Airtime | AIR |
| Data | DAT |
| Electricity | ELE |
| Cable TV | CAB |
| Exam Pin | PIN |
| Bulk SMS | SMS |
| Wallet Fund | FND |
| Withdrawal | WDR |
| Transfer | TRF |
| Bucket | BKT |
| Loan | LNS |
| Refund | RFD |
| Commission | COM |
| Cashback | CBK |

---

## API Versioning Strategy

- All public endpoints: `/api/v1/`
- Version is in the URL path (not header) for maximum client compatibility
- Date-based version header also supported: `API-Version: 2024-01-01`
- When making breaking changes:
  1. Deploy new behavior under `/api/v2/`
  2. Add `Deprecation: true` + `Sunset: {date}` headers to v1 routes
  3. Email all API users with migration guide
  4. Maintain v1 for minimum 6 months after sunset announcement
  5. Log v1 usage to identify active clients before shutdown

---

## Email Templates Required

| Template | Trigger |
|----------|---------|
| `welcome` | Post-registration |
| `email-verify` | Email OTP |
| `transaction-success` | Every debit/credit |
| `transaction-failed` | Failed transaction |
| `low-balance` | Wallet below threshold |
| `exam-pin-delivery` | Pin purchase success |
| `electricity-token` | Token delivery |
| `loan-approved` / `loan-rejected` | Loan decision |
| `loan-due-reminder` | 3 days + 1 day before due |
| `kyc-approved` / `kyc-rejected` | KYC decision |
| `subscription-renewal` | 7 days, 3 days, day-of |
| `subscription-expired` | Grace period warning |
| `dispute-opened` | User submits dispute |
| `dispute-resolved` | Dispute closes |
| `api-key-created` | New API key |
| `security-alert` | New device login / PIN change |
| `monthly-statement` | 1st of each month |
| `cashback-credited` | Cashback campaign pays out |
| `maintenance-scheduled` | 30 min before scheduled maintenance |
| `provider-float-low` | Admin alert |

---

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `provider-health-check` | Every 5 min | Ping providers, update status |
| `provider-float-check` | Every 30 min | Check float levels, auto-fund if enabled |
| `price-sync` | Every 6 hours | Pull latest prices from providers that support API |
| `pending-tx-sweep` | Every 15 min | Re-query provider for pending transactions |
| `dead-letter-retry` | Every 30 min | Attempt DLQ entries during low-traffic periods |
| `loan-due-reminder` | Daily 8AM | Email users with loans due in 1–3 days |
| `auto-loan-repayment` | Daily 12AM | Deduct from wallet if loan due today |
| `bucket-expiry-check` | Daily 6AM | Expire old buckets, notify users |
| `spending-limit-reset` | Daily 12AM | Reset daily spend counters |
| `monthly-statement` | 1st of month 6AM | Email all users their statement |
| `commission-payout` | Daily 6AM | Credit pending commissions to wallets |
| `cashback-process` | Real-time (on txn) | Credit cashback immediately after qualifying txn |
| `subscription-renewal` | Daily 9AM | Remind users with expiring plans |
| `sla-check` | Hourly | Flag breached support ticket / dispute SLAs |
| `referral-drip` | Daily 10AM | Send drip emails to inactive registered users |

---

## Security Rules Summary

### Firestore Rules (Critical)
```
wallets: NO client reads/writes — Admin SDK only
transactions: client read own only — Admin SDK writes only
roles: admin read/write only
api_keys: user read own (except keyHash) — Admin SDK write
ip_blacklist: admin read/write only
system_settings: admin read/write only
dead_letter_queue: admin read/write only
```

### API Security Checklist
- [ ] All debit operations require transaction PIN (verified server-side)
- [ ] Idempotency key checked before processing any VTU purchase
- [ ] Flutterwave webhook: `verif-hash` header verified before processing
- [ ] Processed webhook IDs stored to prevent double-credit
- [ ] Admin routes: permission checked server-side (not just client UI)
- [ ] Impersonation: all actions logged, financial ops blocked
- [ ] Rate limiting: Upstash on all public endpoints
- [ ] Login throttle: 5 attempts / 15 min per IP
- [ ] API keys: never stored raw (SHA-256 hash only)
- [ ] Money: always stored as kobo (integer), never float

---

## Agent Implementation Rules

0. **Path Inclusion** - Always add a commented out file path on the script to show where to put it in project.
1. **All money is in kobo** — multiply NGN by 100. Never use `parseFloat` on money.
2. **All wallet writes go through `lib/wallet/operations.ts`** — no exceptions.
3. **All VTU purchases go through `lib/providers/router.ts`** — never call a provider directly from a route handler.
4. **Every API route validates input with Zod first** — reject before hitting Firebase.
5. **Every financial API route checks idempotency key** — check before processing, store after.
6. **Permission checks server-side only** — the client UI hiding buttons is UX, not security.
7. **Fraud score every debit transaction** — don't skip even for small amounts.
8. **Never hard-delete** — use `isDeleted: true` + `deletedAt` on all collections.
9. **Log every external API call** — provider name, request, response, duration, status.
10. **Expo app never gets admin permissions** — mobile JWT cannot hold admin role.
11. **Test with Firebase Emulator Suite** — never develop against production Firebase.
12. **Staging env is a separate Firebase project** — not just a `.env` flag.
13. **Price is always fetched from Firestore service_config** — never hardcoded.
14. **New roles take effect immediately** — no code deploy needed, middleware loads role at runtime.