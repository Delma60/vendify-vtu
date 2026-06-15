// vtu-web/lib/providers/implementations/sandbox.ts
// AGENTS.md RULES: #3 (payments), #14 (runtime config)
// Equivalent to Laravel's SandboxService — every operation succeeds without
// hitting a real provider. Used when USE_SANDBOX=true.

import { ProviderBase } from '../base';
import type {
  AirtimeParams, CableParams, DataParams, ElectricityParams, ExamPinParams,
  MeterInfo, ProviderResponse, SmartCardInfo, WebhookResult,
} from '@/types/provider';

export class SandboxProvider extends ProviderBase {
  readonly code = 'sandbox';

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  private ok(reference: string, extra: Partial<ProviderResponse> = {}): ProviderResponse {
    return {
      success: true,
      provider: this.code,
      providerReference: `SANDBOX-${reference}`,
      status: 'success',
      message: 'Sandbox transaction successful',
      ...extra,
    };
  }

  async buyAirtime(p: AirtimeParams) { return this.ok(p.reference); }
  async buyData(p: DataParams) { return this.ok(p.reference); }
  async payElectricity(p: ElectricityParams) {
    return this.ok(p.reference, { token: '0000-0000-0000-0000', units: '10kWh' });
  }
  async payCable(p: CableParams) { return this.ok(p.reference); }
  async buyExamPin(p: ExamPinParams) { return this.ok(p.reference, { token: 'SANDBOX-PIN-CODE' }); }

  async verifyMeter(meterNumber: string, disco: string, type: 'prepaid' | 'postpaid'): Promise<MeterInfo> {
    return {
      customerName: 'Sandbox Customer',
      meterNumber, address: 'Sandbox Address', disco, type,
      outstandingBalanceKobo: type === 'postpaid' ? 0 : null,
    };
  }

  async verifySmartCard(cardNumber: string, cableNetwork: string): Promise<SmartCardInfo> {
    return {
      cardNumber, provider: cableNetwork, customerName: 'Sandbox Customer',
      status: 'active', currentBouquetCode: null, currentBouquetName: null,
      dueDate: null, renewalAmountKobo: null,
    };
  }

  async getBalance(): Promise<number> { return 1_000_000_00; }

  async checkTransactionStatus(reference: string): Promise<ProviderResponse> {
    return this.ok(reference);
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<WebhookResult> {
    return { reference: String(payload.reference ?? ''), status: 'success' };
  }
}