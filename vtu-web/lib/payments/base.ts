// vtu-web/lib/payments/base.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #13 (config from Firestore)

import { logExternalCall } from '@/lib/utils/logger';
import type { PaymentGatewayInterface } from './interface';
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
 * Shared functionality for all payment gateways — the payment-side twin of
 * lib/providers/base.ts (ProviderBase). Concrete gateways extend this and
 * implement only the abstract methods.
 */
export abstract class PaymentGatewayBase implements PaymentGatewayInterface {
  abstract readonly code: string;

  constructor(public readonly config: PaymentGatewayConfig) {}

  // ── Must be implemented by each gateway ──────────────────────────────────
  abstract initiateFunding(params: InitiateFundingParams): Promise<PaymentResponse>;
  abstract verifyFunding(params: VerifyFundingParams): Promise<PaymentResponse>;
  abstract payout(params: PayoutParams): Promise<PayoutResult>;
  abstract createVirtualAccount(params: CreateVirtualAccountParams): Promise<VirtualAccountInfo>;
  abstract resolveAccount(params: ResolveAccountParams): Promise<ResolvedAccountInfo>;
  abstract getBalance(): Promise<number>;
  abstract verifyWebhookSignature(headers: Record<string, string | undefined>, rawBody: string): boolean;
  abstract handleWebhook(payload: Record<string, unknown>): Promise<PaymentWebhookResult>;
  protected abstract getAuthHeaders(): Record<string, string>;

  // ── Shared helpers ────────────────────────────────────────────────────────

  supportsCapability(capability: PaymentCapability): boolean {
    return this.config.capabilities.includes(capability);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.getBalance();
      return true;
    } catch {
      return false;
    }
  }

  protected baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  /**
   * Generic HTTP call helper — every external request goes through here so
   * logExternalCall fires consistently (AGENTS.md rule #9).
   */
  protected async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const headers = { ...this.getAuthHeaders(), ...extraHeaders };

    const init: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PUT')) {
      init.body = JSON.stringify(body);
    }

    let ok = false;
    let responseBody: unknown = null;

    try {
      const res = await fetch(url, init);
      ok = res.ok;
      responseBody = await res.json().catch(() => null);
    } catch (error) {
      logExternalCall(this.config.name, path, { method, body }, { error: (error as Error).message }, false);
      throw error;
    }

    logExternalCall(this.config.name, path, { method, body }, responseBody, ok);

    if (!ok) {
      const message = (responseBody as { message?: string })?.message
        ?? `Request to ${this.config.name} failed`;
      throw new Error(message);
    }

    return responseBody as T;
  }
}