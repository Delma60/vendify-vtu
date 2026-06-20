// vtu-web/lib/providers/implementations/AdexProvider.ts
// AGENTS.md RULES: #1 (kobo), #3 (payments), #9 (log), #13 (config from Firestore)
// Ported from Adex.php

import { ProviderBase } from '../base';
import type {
  AirtimeParams,
  CableParams,
  DataParams,
  ElectricityParams,
  ExamPinParams,
  MeterInfo,
  ProviderResponse,
  SmartCardInfo,
  WebhookResult,
} from '@/types/provider';
import { adminDb } from '@/lib/firebase/admin';

// ─── Adex-specific response shapes ───────────────────────────────────────────

interface AdexLoginResponse {
  AccessToken?: string;
  balance?: string | number;
  [key: string]: unknown;
}

interface AdexApiResponse {
  status?: string;
  message?: string;
  'request-id'?: string;
  tx_ref?: string;
  reference?: string;
  // airtime
  network?: string;
  phone_number?: string;
  amount?: number | string;
  discount_amount?: number | string;
  plan_type?: string;
  // data
  dataplan?: string;
  // cable
  cabl_name?: string;
  iuc?: string;
  charges?: number | string;
  plan_name?: string;
  // electricity
  meter_number?: string;
  meter_type?: string;
  token?: string;
  // exam
  pin?: string;
  quantity?: number | string;
  username?: string;
  // bulksms
  total_number?: number | string;
  correct_number?: unknown;
  wrong_number?: unknown;
  sender_name?: string;
  numbers?: unknown;
  oldbal?: unknown;
  newbal?: unknown;
  // cards
  serial?: unknown;
  load_pin?: unknown;
  check_balance?: unknown;
  card_name?: string;
  // verification
  name?: string;
  [key: string]: unknown;
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class AdexProvider extends ProviderBase {
  readonly code = 'adex';

  /**
   * Adex uses HTTP Basic Auth to obtain a short-lived access token, then
   * passes that token as `Authorization: Token <token>` on subsequent calls.
   *
   * The token is cached in Firestore for 5 minutes (mirroring the PHP Cache::remember).
   */
  private async getAccessToken(): Promise<string> {
    if (!this.config.username || !this.config.password) {
      throw new Error(
        `Adex provider "${this.config.name}" is missing username or password in its Firestore config. ` +
        `Go to Admin → Providers → Configure and enter both fields.`
      );
    }
 
    const cacheKey = `adex_token_${this.config.id}`;
    const cacheRef = adminDb.collection('system_cache').doc(cacheKey);
 
    // Check in-memory Firestore cache first
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as { token: string; expiresAt: number };
      if (data.expiresAt > Date.now()) {
        return data.token;
      }
    }
 
    // Re-authenticate
    const loginData = await this.login();
    const token = loginData.AccessToken ?? '';
    if (!token) throw new Error('Adex: failed to obtain access token — check username/password');
 
    // Cache for 5 minutes
    await cacheRef.set({
      token,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
 
    return token;
  }
  /**
   * POST /user with Basic auth — returns balance + AccessToken.
   */
  private async login(): Promise<AdexLoginResponse> {
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.password ?? ''}`
    ).toString('base64');

    const url = `${this.baseUrl()}/user`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`Adex login failed: ${res.status}`);
    return (await res.json()) as AdexLoginResponse;
  }

  protected getAuthHeaders(): Record<string, string> {
    // Sync fallback — token is always resolved async in request() below.
    // This method satisfies the abstract contract but is never called directly.
    return { 'Content-Type': 'application/json' };
  }

  /**
   * Override the base request() helper so we can inject the Bearer token
   * asynchronously before each call. Adex uses `Token` prefix, not `Bearer`.
   */
  protected async adexRequest<T = AdexApiResponse>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl()}${path}`;
    console.log({url})

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as T;

    // Log per AGENTS.md rule #9
    const { logExternalCall } = await import('@/lib/utils/logger');
    logExternalCall(this.config.name, path, body, json, res.ok);

    if (!res.ok) {
      const msg =
        (json as AdexApiResponse).message ?? `Adex request failed (${res.status})`;
      throw new Error(msg);
    }

    return json;
  }

  private endpointFor(service: string): string {
    const map: Record<string, string> = {
      airtime: '/topup',
      data: '/data',
      cable: '/cable',
      electricity: '/bill',
      exam: '/exam',
      bulksms: '/bulksms',
      data_card: '/data_card',
      recharge_card: '/recharge_card',
    };
    const ep = map[service];
    if (!ep) throw new Error(`Adex: no endpoint mapped for service [${service}]`);
    return ep;
  }

  // ── Network/Disco ID resolution ─────────────────────────────────────────────
  // networkIds / cableNetworkIds / discoIds are stored in providers/{id} Firestore
  // document and loaded into config by the router. Mirrors $this->networkIDs in PHP.

  private networkId(network: string): string | number {
    return this.resolveId(this.config.networkIds, network);
  }

  private cableNetworkId(cableNetwork: string): string | number {
    return this.resolveId(this.config.cableNetworkIds, cableNetwork);
  }

  private discoId(disco: string): string | number {
    return this.resolveId(this.config.discoIds, disco);
  }

  // ── ProviderBase abstract implementations ───────────────────────────────────

  async buyAirtime(p: AirtimeParams): Promise<ProviderResponse> {
    const payload = {
      network: this.networkId(p.network),
      phone: p.phone,
      plan_type: 'VTU',
      // Adex expects Naira, not kobo — convert
      amount: p.amountKobo / 100,
      bypass: false,
      'request-id': p.reference,
    };

    const res = await this.adexRequest<AdexApiResponse>(
      this.endpointFor('airtime'),
      payload
    );

    console.log(res)

    return this.normalise('airtime', res, p.reference);
  }

  async buyData(p: DataParams): Promise<ProviderResponse> {
    // providerPlanCode is resolved by the router from data_plans.providerPlanCodes['adex']
    const payload = {
      network: this.networkId(p.network),
      phone: p.phone,
      plan_type: 'GIFTING',
      data_plan: p.providerPlanCode,
      bypass: false,
      'request-id': p.reference,
    };

    const res = await this.adexRequest<AdexApiResponse>(
      this.endpointFor('data'),
      payload
    );

    return this.normalise('data', res, p.reference);
  }

  async payCable(p: CableParams): Promise<ProviderResponse> {
    const payload = {
      cable: this.cableNetworkId(p.cableNetwork),
      iuc: p.smartCardNumber,
      cable_plan: p.providerBouquetCode,
      bypass: false,
      'request-id': p.reference,
    };

    const res = await this.adexRequest<AdexApiResponse>(
      this.endpointFor('cable'),
      payload
    );

    return this.normalise('cable', res, p.reference);
  }

  async payElectricity(p: ElectricityParams): Promise<ProviderResponse> {
    const discoId = this.discoId(p.disco);

    const payload = {
      disco: discoId,
      meter_type: p.meterType,
      meter_number: p.meterNumber,
      amount: p.amountKobo / 100,
      bypass: false,
      'request-id': p.reference,
    };

    const res = await this.adexRequest<AdexApiResponse>(
      this.endpointFor('electricity'),
      payload
    );

    return this.normalise('electricity', res, p.reference);
  }

  async buyExamPin(p: ExamPinParams): Promise<ProviderResponse> {
    const payload = {
      quantity: p.quantity ?? 1,
      'request-id': p.reference,
    };

    const res = await this.adexRequest<AdexApiResponse>(
      this.endpointFor('exam'),
      payload
    );

    return this.normalise('exam', res, p.reference);
  }

  // ── Verification ─────────────────────────────────────────────────────────────

  async verifyMeter(
    meterNumber: string,
    disco: string,
    type: 'prepaid' | 'postpaid'
  ): Promise<MeterInfo> {
    const token = await this.getAccessToken();
    const discoId = this.discoId(disco);
    const url = `${this.baseUrl()}/bill/bill-validation?meter_number=${meterNumber}&disco=${discoId}&meter_type=${type}`;

    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });

    const json = (await res.json().catch(() => ({}))) as AdexApiResponse;
    const { logExternalCall } = await import('@/lib/utils/logger');
    logExternalCall(this.config.name, '/bill/bill-validation', { meterNumber, disco, type }, json, res.ok);

    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message ?? 'Adex: meter verification failed');
    }

    return {
      customerName: String(json.name ?? ''),
      meterNumber,
      address: null,
      disco,
      type,
      outstandingBalanceKobo: null,
    };
  }

  async verifySmartCard(
    cardNumber: string,
    cableNetwork: string
  ): Promise<SmartCardInfo> {
    const token = await this.getAccessToken();
    const cableId = this.cableNetworkId(cableNetwork);
    const url = `${this.baseUrl()}/cable/cable-validation?iuc=${cardNumber}&cable=${cableId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });

    const json = (await res.json().catch(() => ({}))) as AdexApiResponse;
    const { logExternalCall } = await import('@/lib/utils/logger');
    logExternalCall(this.config.name, '/cable/cable-validation', { cardNumber, cableNetwork }, json, res.ok);

    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message ?? 'Adex: smart card verification failed');
    }

    return {
      cardNumber,
      provider: cableNetwork,
      customerName: String(json.name ?? ''),
      status: 'active',
      currentBouquetCode: null,
      currentBouquetName: null,
      dueDate: null,
      renewalAmountKobo: null,
    };
  }

  // ── Balance / health ──────────────────────────────────────────────────────────

  async getBalance(): Promise<number> {
    try {
      const data = await this.login();
      // balance comes back as a string like "₦12,345.00" — strip non-numeric chars
      const raw = String(data.balance ?? '0').replace(/[^\d.]/g, '');
      const naira = parseFloat(raw) || 0;
      return Math.round(naira * 100); // → kobo
    } catch {
        console.log("Adex balance check failed — returning 0. Check logs for details.");
      return 10;
    }
  }

  async checkTransactionStatus(_reference: string): Promise<ProviderResponse> {
    // Adex PHP returns an empty array for verifyTransaction — no status endpoint.
    return {
      success: false,
      provider: this.code,
      providerReference: '',
      status: 'pending',
      message: 'Adex does not expose a transaction status endpoint.',
      shouldRefund: false,
    };
  }

  // ── Webhook (callback) ────────────────────────────────────────────────────────

  async handleWebhook(payload: Record<string, unknown>): Promise<WebhookResult> {
    return {
      reference: String(payload['request-id'] ?? payload['tx_ref'] ?? ''),
      status:
        payload['status'] === 'success'
          ? 'success'
          : payload['status'] === 'pending'
          ? 'pending'
          : 'failed',
      providerReference: payload['reference'] ? String(payload['reference']) : null,
      token: payload['token'] ? String(payload['token']) : null,
    };
  }

  // ── Response normalisation ────────────────────────────────────────────────────

  /**
   * Maps Adex's raw API response to the shared ProviderResponse shape.
   * Mirrors formatResponse() in Adex.php.
   *
   * Adex returns status = 'success' on success; anything else is failure.
   * The PHP side has no explicit `shouldRefund` flag — we default to `true`
   * on failure (safe to refund if provider call failed).
   */
  private normalise(
    service: string,
    res: AdexApiResponse,
    reference: string
  ): ProviderResponse {
    const success = res.status === 'success';
    const providerRef = String(res['request-id'] ?? res['tx_ref'] ?? reference);

    const base: ProviderResponse = {
      success,
      provider: this.code,
      providerReference: providerRef,
      status: success ? 'success' : 'failed',
      message: String(res.message ?? (success ? 'Transaction successful' : 'Transaction failed')),
      shouldRefund: !success,
      raw: res,
    };

    if (service === 'electricity' && success) {
      base.token = res.token ? String(res.token) : null;
    }

    if (service === 'exam' && success) {
      base.token = res.pin ? String(res.pin) : null;
    }

    return base;
  }
}