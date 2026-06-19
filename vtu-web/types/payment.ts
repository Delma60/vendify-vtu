// vtu-web/types/payment.ts
// AGENTS.md RULES: #1 (kobo), #13 (config from Firestore)

import { Timestamp } from 'firebase-admin/firestore';

export type PaymentCapability = 'fund' | 'payout' | 'virtual_account' | 'card';

// ─── Auth method supported by a payment gateway ──────────────────────────────
//
// | authMethod   | Fields used                                |
// |--------------|---------------------------------------------|
// | secret_key   | secretKey (Bearer/secret header)             |
// | public_secret| publicKey + secretKey (init vs verify calls) |
// | basic        | username + password (HTTP Basic Auth)        |

export type PaymentAuthMethod = 'secret_key' | 'public_secret' | 'basic';

// ─── Gateway config (loaded from Firestore `payment_gateways` collection) ────

export interface PaymentGatewayConfig {
  id: string;
  code: string;               // implementation key used by PaymentGatewayFactory, e.g. 'flutterwave', 'paystack'
  name: string;                // display name, e.g. "Flutterwave"
  baseUrl: string;

  authMethod: PaymentAuthMethod;
  publicKey?: string;
  secretKey: string;
  encryptionKey?: string;      // Flutterwave-style card encryption, optional per gateway
  webhookSecret: string;       // used to verify inbound webhook signature header

  identifier: string;          // webhook routing key, e.g. matches /api/webhooks/:identifier
  isActive: boolean;
  capabilities: PaymentCapability[];
  priority: Partial<Record<PaymentCapability, number>>;

  // Per-gateway settings that don't belong in env (rule #13: config from Firestore)
  defaultVirtualAccountBank?: string;   // e.g. 'wema-bank' — gateway-specific bank pool
  payoutSourceCurrency?: string;        // defaults to 'NGN'

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Operation params ─────────────────────────────────────────────────────────

export interface InitiateFundingParams {
  userId: string;
  amountKobo: number;
  email: string;
  reference: string;           // internal reference, e.g. VTX-FND-...
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface VerifyFundingParams {
  reference: string;            // our internal reference
  providerReference?: string;   // gateway's transaction id, if known
}

export interface PayoutParams {
  reference: string;
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  accountName?: string;
  narration?: string;
  currency?: string;            // defaults to NGN
}

export interface CreateVirtualAccountParams {
  userId: string;
  email: string;
  phone: string;
  bvn?: string;
  firstName: string;
  lastName: string;
  /** narrowed reference used so the account can be looked up/regenerated idempotently */
  reference: string;
}

export interface ResolveAccountParams {
  bankCode: string;
  accountNumber: string;
}

// ─── Normalised results ────────────────────────────────────────────────────────

export interface PaymentResponse {
  success: boolean;
  provider: string;             // gateway code
  providerReference: string;
  status: 'success' | 'pending' | 'failed';
  message: string;
  amountKobo?: number;
  authorizationUrl?: string;    // for redirect-based funding (card/checkout link)
  raw?: unknown;
}

export interface VirtualAccountInfo {
  accountNumber: string;
  bankName: string;
  accountName: string;
  providerReference: string;
  expiresAt: string | null;     // some gateways issue static accounts (null), others expire
}

export interface ResolvedAccountInfo {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface PayoutResult {
  success: boolean;
  provider: string;
  providerReference: string;
  status: 'success' | 'pending' | 'failed';
  message: string;
  fee: number | null;           // kobo, if the gateway reports it back
  raw?: unknown;
}

export interface PaymentWebhookResult {
  /** our internal reference, e.g. transactions.reference */
  reference: string;
  type: 'funding' | 'payout' | 'unknown';
  status: 'success' | 'failed' | 'pending';
  amountKobo?: number;
  providerReference?: string | null;
}

// ─── Gateway registry entry (used by admin UI) ────────────────────────────────

export interface PaymentGatewayRegistryEntry {
  /** Must match PaymentGatewayConfig.code stored in Firestore */
  code: string;
  /** Human-readable name shown in the dropdown */
  label: string;
  authMethod: PaymentAuthMethod;
  credentialHints: {
    publicKey?: string;
    secretKey?: string;
    encryptionKey?: string;
    webhookSecret?: string;
  };
  /** Capabilities this gateway is known to support (defaults shown in form) */
  defaultCapabilities: PaymentCapability[];
  docsUrl?: string;
}