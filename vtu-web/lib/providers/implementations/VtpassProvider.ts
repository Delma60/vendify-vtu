// vtu-web/lib/providers/implementations/vtpass.ts
// AGENTS.md RULES: #1 (kobo), #3 (payments), #9 (log), #13 (config from Firestore)
// Ported from vtpass.php

import { ProviderBase } from '../base';
import type {
  AirtimeParams, CableParams, DataParams, ElectricityParams, ExamPinParams,
  MeterInfo, ProviderResponse, SmartCardInfo, WebhookResult,
} from '@/types/provider';

interface VtpassPayResponse {
  code: string;
  response_description?: string;
  requestId?: string;
  request_id?: string;
  transactionId?: string;
  amount?: number;
  purchased_code?: string;   // token / pin
  token?: string;
  content?: { transactions?: { product_name?: string } };
}

export class VtpassProvider extends ProviderBase {
  readonly code = 'vtpass';

  protected getAuthHeaders(): Record<string, string> {
    return {
      'api-key': this.config.apiKey,
      'public-key': this.config.publicKey ?? '',
      'Content-Type': 'application/json',
    };
  }

  // ── Airtime / Data / Cable / Electricity / Exam all hit /pay ──────────────

  async buyAirtime(p: AirtimeParams): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('POST', '/pay', {
      request_id: p.reference,
      serviceID: p.network.toLowerCase(),
      amount: p.amountKobo / 100, // VTPass expects Naira
      phone: p.phone,
    });
    return this.toProviderResponse(res);
  }

  async buyData(p: DataParams): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('POST', '/pay', {
      request_id: p.reference,
      serviceID: `${p.network.toLowerCase()}-data`,
      billersCode: p.phone,
      variation_code: p.providerPlanCode,
      amount: p.amountKobo / 100,
    });
    return this.toProviderResponse(res);
  }

  async payCable(p: CableParams): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('POST', '/pay', {
      request_id: p.reference,
      serviceID: p.cableNetwork.toLowerCase(),
      billersCode: p.smartCardNumber,
      variation_code: p.providerBouquetCode,
    });
    return this.toProviderResponse(res);
  }

  async payElectricity(p: ElectricityParams): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('POST', '/pay', {
      request_id: p.reference,
      serviceID: p.disco.toLowerCase(),
      billersCode: p.meterNumber,
      variation_code: p.meterType,
      amount: p.amountKobo / 100,
    });
    return this.toProviderResponse(res, { token: res.purchased_code ?? res.token ?? null });
  }

  async buyExamPin(p: ExamPinParams): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('POST', '/pay', {
      request_id: p.reference,
      serviceID: p.examType.toLowerCase(),
      variation_code: p.variationCode,
      amount: p.amountKobo / 100,
    });
    return this.toProviderResponse(res, { token: res.purchased_code ?? null });
  }

  // ── Verification ───────────────────────────────────────────────────────────

  async verifyMeter(meterNumber: string, disco: string, type: 'prepaid' | 'postpaid'): Promise<MeterInfo> {
    const res = await this.request<{
      code: string;
      content?: { Customer_Name?: string; Address?: string; Outstanding_balance?: string };
      response_description?: string;
    }>('POST', '/merchant-verify', {
      billersCode: meterNumber,
      serviceID: disco.toLowerCase(),
      type,
    });

    if (res.code !== '000' || !res.content) {
      throw new Error(res.response_description ?? 'Meter verification failed');
    }

    const outstanding = res.content.Outstanding_balance ? Number(res.content.Outstanding_balance) : null;

    return {
      customerName: res.content.Customer_Name ?? '',
      meterNumber,
      address: res.content.Address ?? null,
      disco,
      type,
      outstandingBalanceKobo: outstanding !== null ? Math.round(outstanding * 100) : null,
    };
  }

  async verifySmartCard(cardNumber: string, cableNetwork: string): Promise<SmartCardInfo> {
    const res = await this.request<{
      code: string;
      content?: { Customer_Name?: string; Current_Bouquet?: string; Due_Date?: string; Renewal_Amount?: string };
      response_description?: string;
    }>('POST', '/merchant-verify', {
      billersCode: cardNumber,
      serviceID: cableNetwork.toLowerCase(),
    });

    if (res.code !== '000' || !res.content) {
      throw new Error(res.response_description ?? 'Smart card verification failed');
    }

    return {
      cardNumber,
      provider: cableNetwork,
      customerName: res.content.Customer_Name ?? '',
      status: 'active',
      currentBouquetCode: null,
      currentBouquetName: res.content.Current_Bouquet ?? null,
      dueDate: res.content.Due_Date ?? null,
      renewalAmountKobo: res.content.Renewal_Amount ? Math.round(Number(res.content.Renewal_Amount) * 100) : null,
    };
  }

  // ── Balance / status ─────────────────────────────────────────────────────

  async getBalance(): Promise<number> {
    const res = await this.request<{ contents?: { balance?: string | number } }>('GET', '/balance');
    const balanceNaira = Number(res.contents?.balance ?? 0);
    return Math.round(balanceNaira * 100); // → kobo
  }

  async checkTransactionStatus(reference: string): Promise<ProviderResponse> {
    const res = await this.request<VtpassPayResponse>('GET', `/requery?request_id=${encodeURIComponent(reference)}`);
    return this.toProviderResponse(res);
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  async handleWebhook(payload: Record<string, unknown>): Promise<WebhookResult> {
    const code = String(payload.code ?? '');
    return {
      reference: String(payload.request_id ?? ''),
      status: code === '000' ? 'success' : 'failed',
      providerReference: payload.transactionId ? String(payload.transactionId) : null,
      token: (payload.purchased_code as string) ?? null,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toProviderResponse(res: VtpassPayResponse, extra: Partial<ProviderResponse> = {}): ProviderResponse {
    const success = res.code === '000';
    return {
      success,
      provider: this.code,
      providerReference: res.transactionId ?? res.request_id ?? res.requestId ?? '',
      status: success ? 'success' : 'failed',
      message: res.response_description ?? (success ? 'Transaction successful' : 'Transaction failed'),
      // VTPass returns code '000' only on confirmed success; any other code
      // for a /pay call means no charge was made — safe to refund.
      shouldRefund: !success,
      raw: res,
      ...extra,
    };
  }
}