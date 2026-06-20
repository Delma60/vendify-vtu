// vtu-web/lib/providers/base.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #13 (config from Firestore)

import { logExternalCall } from '@/lib/utils/logger';
import type { VTUProviderInterface } from './interface';
import type {
  AirtimeParams, CableParams, DataParams, ElectricityParams, ExamPinParams,
  MeterInfo, ProviderConfig, ProviderResponse, ServiceType, SmartCardInfo, WebhookResult,
} from '@/types/provider';

/**
 * Shared functionality for all VTU providers — equivalent to VendorBase.php.
 * Concrete providers extend this and implement only the abstract methods.
 */
export abstract class ProviderBase implements VTUProviderInterface {
  abstract readonly code: string;

  constructor(public readonly config: ProviderConfig) {}

  // ── Must be implemented by each provider ─────────────────────────────────
  abstract buyAirtime(params: AirtimeParams): Promise<ProviderResponse>;
  abstract buyData(params: DataParams): Promise<ProviderResponse>;
  abstract payElectricity(params: ElectricityParams): Promise<ProviderResponse>;
  abstract payCable(params: CableParams): Promise<ProviderResponse>;
  abstract buyExamPin(params: ExamPinParams): Promise<ProviderResponse>;
  abstract verifyMeter(meterNumber: string, disco: string, type: 'prepaid' | 'postpaid'): Promise<MeterInfo>;
  abstract verifySmartCard(cardNumber: string, cableNetwork: string): Promise<SmartCardInfo>;
  abstract getBalance(): Promise<number>;
  abstract checkTransactionStatus(reference: string): Promise<ProviderResponse>;
  abstract handleWebhook(payload: Record<string, unknown>): Promise<WebhookResult>;
  protected abstract getAuthHeaders(): Record<string, string>;
  abstract getDataPlans(network: string): Promise<any[]> ;

  // ── Shared helpers ────────────────────────────────────────────────────────

  supportsService(service: ServiceType): boolean {
    return this.config.services.includes(service);
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
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const headers = { ...this.getAuthHeaders(), ...extraHeaders };

    const init: RequestInit = { method, headers };
    if (body && method === 'POST') {
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
      const message = (responseBody as { message?: string; response_description?: string })?.message
        ?? (responseBody as { response_description?: string })?.response_description
        ?? `Request to ${this.config.name} failed`;
      throw new Error(message);
    }

    return responseBody as T;
  }

  /** Helper for resolving a network/disco/cable ID from this provider's config maps. */
  protected resolveId(map: Record<string, string | number> | undefined, key: string): string | number {
    const id = map?.[key.toLowerCase()];
    if (id === undefined) {
      throw new Error(`${this.config.name}: no mapping configured for "${key}"`);
    }
    return id;
  }
}