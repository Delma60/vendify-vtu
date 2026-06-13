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
  transactionPin: string | null; // bcrypt hashed
  subscriptionPlanId: string;
  subscriptionExpiresAt: Timestamp | null;
  parentResellerId: string | null;
  resellerLevel: number;
  hasBucket: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  spendingLimits: {
    dailyLimit: number | null;
    weeklyLimit: number | null;
    dailySpent: number;
    weeklySpent: number;
    lastResetDate: string; // YYYY-MM-DD
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
  id: string; // fingerprint
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
  secret: string; // TOTP secret (encrypted at rest)
  method: 'email_otp' | 'totp';
  isVerified: boolean;
  backupCodes: string[]; // hashed
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

// Flutterwave

export interface FlutterwaveResponse<T = unknown> {
    status: string;
    message: string;
    data: T;
}

export interface FlutterwaveWebhookEvent {
    eventType: string;
    eventData: any;
    eventStatus: string;
    eventTime: string;
    eventReference: string;
}

export interface PayoutRequest {
    amount:number;
    currency:string;
    recipientId:string;
    metadata?:Record<string, any>;
}

export interface PayoutResponse {
    status: 'success' | 'error';
    data: any;
    message: string;
}