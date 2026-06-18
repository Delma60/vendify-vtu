// vtu-web/types/index.ts
import { Timestamp } from 'firebase-admin/firestore';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  avatar: string | null;
  roleId: string;
  kycTier: 0 | 1 | 2 | 3;
  referralCode: string;
  referredBy: string | null;
  isActive: boolean;
  isFrozen: boolean;
  transactionPin: string | null;   // bcrypt hashed
  subscriptionPlanId: string;
  subscriptionExpiresAt: Timestamp | null;
  parentResellerId: string | null;
  resellerLevel: number;
  hasBucket: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  spendingLimits: {
    dailyLimit: number | null;     // in kobo
    weeklyLimit: number | null;    // in kobo
    dailySpent: number;
    weeklySpent: number;
    lastResetDate: string;         // YYYY-MM-DD
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  fcmTokens: string[];
  whatsappNumber: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface Wallet {
  userId: string;
  balance: number;                 // ALWAYS in kobo (integer)
  currency: 'NGN';
  virtualAccountNumber: string;
  virtualAccountBank: string;
  virtualAccountRef: string;
  totalFunded: number;             // kobo
  totalSpent: number;              // kobo
  totalWithdrawn: number;          // kobo
  lockedBalance: number;           // kobo — funds held for pending disputes
  updatedAt: Timestamp;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionCategory =
  | 'airtime'
  | 'data'
  | 'electricity'
  | 'cable'
  | 'exam_pin'
  | 'sms'
  | 'wallet_fund'
  | 'withdrawal'
  | 'transfer'
  | 'bucket_purchase'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'event_ticket'
  | 'refund'
  | 'commission'
  | 'cashback'
  | 'fee'
  | 'internet'          // ← new
  | 'airtime_to_cash';

export type TransactionStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'reversed'
  | 'disputed';

export interface Transaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  category: TransactionCategory | string;
  amount: number;                  // in kobo
  fee: number;                     // platform fee in kobo
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  reference: string;               // VTX-AIR-1718271234567-A7F3K2
  providerReference: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  failureReason: string | null;
  retryCount: number;
  fraudScore: number;              // 0-100
  isApiTransaction: boolean;
  apiKeyId: string | null;
  idempotencyKey: string | null;
  receiptUrl: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionPayload {
  uid: string;
  email: string;
  roleId: string;
  sessionId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

export interface DeviceInfo {
  id: string;
  userAgent: string;
  ip: string;
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
}

export interface LoginAttempt {
  ip: string;
  count: number;
  lockedUntil: Timestamp | null;
  updatedAt: Timestamp;
}

export interface TwoFactorSetup {
  userId: string;
  secret: string;                  // TOTP secret (encrypted at rest)
  method: 'email_otp' | 'totp';
  isVerified: boolean;
  backupCodes: string[];           // hashed
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── API response ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Role / Permission ────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface DataPlan {
  id?: string;
  network: string;
  plan: {
    value:string|number;
    unit:"MB"|"GB"
  };
  size: "MB"|"GB";
  planType: string|NetworkType;

  validity: string;
  priceInKobo: number;
  isActive:boolean;
  rolePrice: {
    [role:string]: {
      type: "fixed"|"percentile"
      value: number
    }

  }                   // in kobo
  providerPlanId: string;
  provider:{
    id:string;
    costPrice:string;
  }
}

export interface MeterInfo {
  customerName: string;
  meterNumber: string;
  address: string;
  disco: string;
  type: 'prepaid' | 'postpaid';
}

export interface SmartCardInfo {
  customerName: string;
  cardNumber: string;
  provider: string;
  currentPlan: string;
  dueDate: string | null;
}

export interface VTUProviderResponse {
  success: boolean;
  reference: string;
  providerReference: string;
  data?: unknown;
  error?: string;
  shouldRefund?: boolean;
}

// ─── Flutterwave ──────────────────────────────────────────────────────────────

export interface FlutterwaveResponse<T = unknown> {
  status: string;
  message: string;
  data: T;
}

export interface FlutterwaveWebhookEvent {
  eventType: string;
  eventData: unknown;
  eventStatus: string;
  eventTime: string;
  eventReference: string;
}

export interface PayoutRequest {
  amount: number;
  currency: string;
  recipientId: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutResponse {
  status: 'success' | 'error';
  data: unknown;
  message: string;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;            // in kobo
  annualPrice: number;             // in kobo
  features: {
    apiAccess: boolean;
    bucketAccess: boolean;
    loanAccess: boolean;
    whitelabelAccess: boolean;
    maxDailyTransactions: number | null;
    rateDiscount: number;
    prioritySupport: boolean;
    maxApiKeys: number;
  };
  isActive: boolean;
  displayOrder: number;
  createdAt: Timestamp;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface SmsProviderResponse {
  success: boolean;
  messageId: string | null;
  error?: string;
}

export interface WhatsappMessageResponse {
  success: boolean;
  messageId: string | null;
  error?: string;
}


export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type PermissionGroups = Record<string, string[]>;

export interface Network {
  id: string;
  name: string;
  shortcode: string;
  type: 'telecom' | 'cable' | 'electricity';
  color: string;
  logoLetter: string;
  isActive: boolean;
  airtimeEnabled: boolean;
  dataEnabled: boolean;
}

export interface NetworkType {
  id:string;
  name:string;
  type: 'airtime'|'data' | 'cable';
  isActive: boolean
  
}

export interface AirtimeTypeConfig {
  id: string;
  type: AirtimeType;
  name: string;
  isActive: boolean;
}
