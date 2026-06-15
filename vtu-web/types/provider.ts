// vtu-web/types/provider.ts
// AGENTS.md RULES: #1 (kobo), #13 (config from Firestore)

import { Timestamp } from 'firebase-admin/firestore';

export type ServiceType = 'airtime' | 'data' | 'cable' | 'electricity' | 'exam' | 'sms';

// ─── Auth method supported by a provider ─────────────────────────────────────

/**
 * Describes which credential fields a provider uses.
 *
 * | authMethod   | Fields used                              |
 * |--------------|------------------------------------------|
 * | api_key      | apiKey                                   |
 * | basic        | username + password (HTTP Basic Auth)    |
 * | bearer       | apiKey sent as Bearer token              |
 * | token_login  | username + password → exchange for token |
 */
export type ProviderAuthMethod = 'api_key' | 'basic' | 'bearer' | 'token_login';

// ─── Provider config (loaded from Firestore `providers` collection) ──────────

export interface ProviderConfig {
  id: string;
  code: string;              // implementation key used by ProviderFactory, e.g. 'adex', 'vtpass'
  name: string;              // display name, e.g. "VTPass"
  baseUrl: string;

  // ── Credentials (store only what the provider needs) ──────────────────────
  authMethod: ProviderAuthMethod;
  apiKey: string;            // used by api_key / bearer methods; leave '' for basic-only providers
  publicKey?: string;
  secretKey?: string;
  username?: string;         // used by basic / token_login
  password?: string;         // used by basic / token_login

  identifier: string;        // webhook routing key
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

// ─── Provider registry entry (used by admin UI) ───────────────────────────────

/**
 * Metadata about a provider implementation class.
 * Returned by ProviderFactory.getRegistry() and surfaced in the admin UI
 * so admins pick a real code from a dropdown instead of typing freehand.
 */
export interface ProviderRegistryEntry {
  /** Must match ProviderConfig.code stored in Firestore */
  code: string;
  /** Human-readable name shown in the dropdown */
  label: string;
  /** Which auth fields this provider needs */
  authMethod: ProviderAuthMethod;
  /** Credential field hints shown in the add-provider form */
  credentialHints: {
    apiKey?: string;        // placeholder text for the api_key field
    publicKey?: string;
    secretKey?: string;
    username?: string;
    password?: string;
  };
  /** Services this provider is known to support (defaults shown in form) */
  defaultServices: ServiceType[];
  /** URL of the provider's developer docs (optional, shown as a link) */
  docsUrl?: string;
}


export interface IDataPlan extends IPlan {
  network:string;
  plan:string;
  plan_name:string;
  plan_size:string;
  plan_type:string;
  validity:string;
}



export interface IPlan  {
  readonly id:string;

  rolePrices?:Record<string,number>;

  price?:string;
  price_ngn:string;
  status:"active"|"inactive";
  active:boolean;
  type:string;

}
