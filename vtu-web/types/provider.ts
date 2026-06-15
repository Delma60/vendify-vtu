// vtu-web/lib/providers/types.ts
// AGENTS.md RULES: #1 (kobo), #13 (config from Firestore)

import { Timestamp } from 'firebase-admin/firestore';

export type ServiceType = 'airtime' | 'data' | 'cable' | 'electricity' | 'exam' | 'sms';

// ─── Provider config (loaded from Firestore `providers` collection) ──────────

export interface ProviderConfig {
  id: string;
  code: string;              // implementation key used by ProviderFactory
  name: string;               // display name, e.g. "VTPass"
  baseUrl: string;
  apiKey: string;
  publicKey?: string;
  secretKey?: string;
  identifier: string;         // webhook routing key
  isActive: boolean;
  services: ServiceType[];
  priority: Partial<Record<ServiceType, number>>;
  networkIds?: Record<string, string | number>;
  cableNetworkIds?: Record<string, string | number>;
  discoIds?: Record<string, string | number>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Operation params ──────────────────────────────────────────────────────────

export interface AirtimeParams {
  phone: string;
  network: string;          // 'mtn' | 'airtel' | 'glo' | '9mobile'
  amountKobo: number;
  reference: string;
}

export interface DataParams {
  phone: string;
  network: string;
  amountKobo: number;
  reference: string;
  /** Resolved per-provider plan code, taken from dataPlan.providerPlanCodes[provider.code] */
  providerPlanCode: string;
}

export interface CableParams {
  smartCardNumber: string;
  cableNetwork: string;     // 'dstv' | 'gotv' | 'startimes'
  reference: string;
  providerBouquetCode: string;
  providerAddonCodes?: string[];
  customerName?: string;
}

export interface ElectricityParams {
  meterNumber: string;
  disco: string;
  meterType: 'prepaid' | 'postpaid';
  amountKobo: number;
  reference: string;
  customerName?: string;
}

export interface ExamPinParams {
  examType: string;
  variationCode: string;
  quantity: number;
  amountKobo: number;
  reference: string;
}

// ─── Normalised results ────────────────────────────────────────────────────────

export interface ProviderResponse {
  success: boolean;
  provider: string;             // provider code
  providerReference: string;
  status: 'success' | 'pending' | 'failed';
  message: string;
  token?: string | null;
  units?: string | null;
  /** true if the provider confirms no charge was made — safe to refund wallet */
  shouldRefund?: boolean;
  raw?: unknown;
}

export interface MeterInfo {
  customerName: string;
  meterNumber: string;
  address: string | null;
  disco: string;
  type: 'prepaid' | 'postpaid';
  outstandingBalanceKobo: number | null;
}

export interface SmartCardInfo {
  cardNumber: string;
  provider: string;
  customerName: string;
  status: 'active' | 'inactive' | 'unknown';
  currentBouquetCode: string | null;
  currentBouquetName: string | null;
  dueDate: string | null;
  renewalAmountKobo: number | null;
}

export interface WebhookResult {
  reference: string;       // matches transactions.transaction_reference
  status: 'success' | 'failed' | 'pending';
  token?: string | null;
  providerReference?: string | null;
}