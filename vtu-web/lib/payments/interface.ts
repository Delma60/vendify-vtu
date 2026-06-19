// vtu-web/lib/payments/interface.ts
// AGENTS.md RULES: #3 (payments), #13 (config from Firestore)

import type {
  CreateVirtualAccountParams,
  InitiateFundingParams,
  PaymentCapability,
  PaymentGatewayConfig,
  PaymentResponse,
  PaymentWebhookResult,
  PayoutParams,
  PayoutResult,
  ResolveAccountParams,
  ResolvedAccountInfo,
  VerifyFundingParams,
  VirtualAccountInfo,
} from '@/types/payment';

/**
 * Every concrete payment gateway (Flutterwave, Paystack, Monnify, ...) must
 * implement this interface. PaymentGatewayFactory.make() returns this type.
 *
 * Mirrors lib/providers/interface.ts (VTUProviderInterface) so the two
 * provider families stay symmetrical and predictable to work with.
 */
export interface PaymentGatewayInterface {
  readonly code: string;
  readonly config: PaymentGatewayConfig;

  /** Start a wallet-funding charge (card / bank transfer / USSD checkout link). */
  initiateFunding(params: InitiateFundingParams): Promise<PaymentResponse>;

  /** Re-query the gateway to confirm a funding transaction actually succeeded. */
  verifyFunding(params: VerifyFundingParams): Promise<PaymentResponse>;

  /** Send money out to a bank account (withdrawals, provider auto-fund, commission payout). */
  payout(params: PayoutParams): Promise<PayoutResult>;

  /** Create or fetch a dedicated virtual account number for a user. */
  createVirtualAccount(params: CreateVirtualAccountParams): Promise<VirtualAccountInfo>;

  /** Resolve a bank account number to its account name (used before payouts). */
  resolveAccount(params: ResolveAccountParams): Promise<ResolvedAccountInfo>;

  /** Fetch the gateway's settlement/payout balance, where supported. */
  getBalance(): Promise<number>;

  supportsCapability(capability: PaymentCapability): boolean;
  isHealthy(): Promise<boolean>;

  /** Verify an inbound webhook signature header against this gateway's secret. */
  verifyWebhookSignature(headers: Record<string, string | undefined>, rawBody: string): boolean;

  /** Normalise an inbound webhook/callback payload from this gateway. */
  handleWebhook(payload: Record<string, unknown>): Promise<PaymentWebhookResult>;
}