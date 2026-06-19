// vtu-web/lib/payments/implementations/FlutterwaveGateway.ts
// AGENTS.md RULES: #1 (kobo), #3 (payments), #9 (log), #13 (config from Firestore)

import { PaymentGatewayBase } from '../base';
import type {
  CreateVirtualAccountParams, InitiateFundingParams, PaymentResponse, PaymentWebhookResult,
  PayoutParams, PayoutResult, ResolveAccountParams, ResolvedAccountInfo, VerifyFundingParams,
  VirtualAccountInfo,
} from '@/types/payment';

// ─── Flutterwave-specific response shapes ────────────────────────────────────

interface FlwStandardResponse<T = unknown> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}

interface FlwInitiateData {
  link?: string;
}

interface FlwTransactionVerifyData {
  id?: number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  currency?: string;
  status?: string;             // 'successful' | 'failed' | 'pending'
}

interface FlwTransferData {
  id?: number;
  reference?: string;
  status?: string;             // 'NEW' | 'SUCCESSFUL' | 'FAILED'
  fee?: number;
  complete_message?: string;
}

interface FlwVirtualAccountData {
  account_number?: string;
  bank_name?: string;
  flw_ref?: string;
  order_ref?: string;
  expiry_date?: string | null;
}

interface FlwResolveAccountData {
  account_number?: string;
  account_name?: string;
}

interface FlwBalanceData {
  currency?: string;
  available_balance?: number;
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class FlutterwaveGateway extends PaymentGatewayBase {
  readonly code = 'flutterwave';

  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ── Funding ──────────────────────────────────────────────────────────────

  /**
   * Creates a hosted checkout link. The user is redirected there to pay by
   * card / bank transfer / USSD; Flutterwave then calls our webhook and the
   * user is redirected back to redirectUrl.
   */
  async initiateFunding(p: InitiateFundingParams): Promise<PaymentResponse> {
    const res = await this.request<FlwStandardResponse<FlwInitiateData>>('POST', '/payments', {
      tx_ref: p.reference,
      amount: p.amountKobo / 100, // Flutterwave expects Naira
      currency: 'NGN',
      redirect_url: p.redirectUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet/fund/callback`,
      customer: { email: p.email },
      meta: p.metadata ?? {},
    });

    const success = res.status === 'success' && !!res.data?.link;

    return {
      success,
      provider: this.code,
      providerReference: p.reference,
      status: success ? 'pending' : 'failed', // funding is pending until the user completes checkout
      message: res.message ?? (success ? 'Checkout link created' : 'Failed to initiate funding'),
      amountKobo: p.amountKobo,
      authorizationUrl: res.data?.link,
      raw: res,
    };
  }

  /**
   * Re-queries Flutterwave to confirm a transaction's true status before we
   * credit the wallet. Always call this from the webhook handler / callback
   * route rather than trusting the webhook payload alone.
   */
  async verifyFunding(p: VerifyFundingParams): Promise<PaymentResponse> {
    // Flutterwave's /transactions/:id/verify needs their numeric id. If we
    // only have our tx_ref, use the search-by-reference endpoint first.
    let txId = p.providerReference;

    if (!txId) {
      const search = await this.request<FlwStandardResponse<FlwTransactionVerifyData[]>>(
        'GET',
        `/transactions?tx_ref=${encodeURIComponent(p.reference)}`
      );
      txId = search.data?.[0]?.id ? String(search.data[0].id) : undefined;
    }

    if (!txId) {
      return {
        success: false,
        provider: this.code,
        providerReference: '',
        status: 'failed',
        message: 'Transaction not found on Flutterwave',
      };
    }

    const res = await this.request<FlwStandardResponse<FlwTransactionVerifyData>>(
      'GET',
      `/transactions/${txId}/verify`
    );

    const successful = res.status === 'success' && res.data?.status === 'successful';
    const amountKobo = res.data?.amount ? Math.round(res.data.amount * 100) : undefined;

    return {
      success: successful,
      provider: this.code,
      providerReference: res.data?.flw_ref ?? String(txId),
      status: successful ? 'success' : res.data?.status === 'pending' ? 'pending' : 'failed',
      message: res.message ?? (successful ? 'Transaction verified' : 'Verification failed'),
      amountKobo,
      raw: res,
    };
  }

  // ── Payout ───────────────────────────────────────────────────────────────

  async payout(p: PayoutParams): Promise<PayoutResult> {
    const res = await this.request<FlwStandardResponse<FlwTransferData>>('POST', '/transfers', {
      account_bank: p.bankCode,
      account_number: p.accountNumber,
      amount: p.amountKobo / 100,
      narration: p.narration ?? 'Withdrawal',
      currency: p.currency ?? this.config.payoutSourceCurrency ?? 'NGN',
      reference: p.reference,
    });

    const success = res.status === 'success';
    const transferStatus = res.data?.status;

    return {
      success,
      provider: this.code,
      providerReference: res.data?.reference ?? p.reference,
      // 'NEW' means accepted/queued, not yet confirmed — treat as pending
      status: transferStatus === 'SUCCESSFUL' ? 'success' : transferStatus === 'FAILED' ? 'failed' : 'pending',
      message: res.data?.complete_message ?? res.message ?? (success ? 'Payout initiated' : 'Payout failed'),
      fee: res.data?.fee != null ? Math.round(res.data.fee * 100) : null,
      raw: res,
    };
  }

  // ── Virtual accounts ─────────────────────────────────────────────────────

  async createVirtualAccount(p: CreateVirtualAccountParams): Promise<VirtualAccountInfo> {
    const res = await this.request<FlwStandardResponse<FlwVirtualAccountData>>(
      'POST',
      '/virtual-account-numbers',
      {
        email: p.email,
        is_permanent: true,
        bvn: p.bvn,
        tx_ref: p.reference,
        phonenumber: p.phone,
        firstname: p.firstName,
        lastname: p.lastName,
        narration: `${p.firstName} ${p.lastName}`,
      }
    );

    if (res.status !== 'success' || !res.data?.account_number) {
      throw new Error(res.message ?? 'Flutterwave: failed to create virtual account');
    }

    return {
      accountNumber: res.data.account_number,
      bankName: res.data.bank_name ?? this.config.defaultVirtualAccountBank ?? 'Wema Bank',
      accountName: `${p.firstName} ${p.lastName}`,
      providerReference: res.data.flw_ref ?? res.data.order_ref ?? p.reference,
      expiresAt: res.data.expiry_date ?? null,
    };
  }

  // ── Account resolution (used before payouts) ─────────────────────────────

  async resolveAccount(p: ResolveAccountParams): Promise<ResolvedAccountInfo> {
    const res = await this.request<FlwStandardResponse<FlwResolveAccountData>>(
      'POST',
      '/accounts/resolve',
      { account_number: p.accountNumber, account_bank: p.bankCode }
    );

    if (res.status !== 'success' || !res.data?.account_name) {
      throw new Error(res.message ?? 'Flutterwave: account resolution failed');
    }

    return {
      accountNumber: res.data.account_number ?? p.accountNumber,
      accountName: res.data.account_name,
      bankCode: p.bankCode,
    };
  }

  // ── Balance ───────────────────────────────────────────────────────────────

  async getBalance(): Promise<number> {
    const res = await this.request<FlwStandardResponse<FlwBalanceData>>('GET', '/balances/NGN');
    const naira = res.data?.available_balance ?? 0;
    return Math.round(naira * 100); // → kobo
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  /**
   * Flutterwave signs webhooks with a static secret-hash header (verif-hash),
   * not an HMAC over the body — compare directly against the configured
   * webhookSecret. (AGENTS.md security checklist: webhook signature verified
   * before processing.)
   */
  verifyWebhookSignature(headers: Record<string, string | undefined>, _rawBody: string): boolean {
    const signature = headers['verif-hash'] ?? headers['Verif-Hash'];
    if (!signature || !this.config.webhookSecret) return false;
    return signature === this.config.webhookSecret;
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<PaymentWebhookResult> {
    const event = String(payload.event ?? '');
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (event.startsWith('transfer')) {
      const status = String(data.status ?? '').toUpperCase();
      return {
        reference: String(data.reference ?? ''),
        type: 'payout',
        status: status === 'SUCCESSFUL' ? 'success' : status === 'FAILED' ? 'failed' : 'pending',
        providerReference: data.id ? String(data.id) : null,
      };
    }

    // Default: charge/funding event
    const status = String(data.status ?? '').toLowerCase();
    return {
      reference: String(data.tx_ref ?? ''),
      type: 'funding',
      status: status === 'successful' ? 'success' : status === 'pending' ? 'pending' : 'failed',
      amountKobo: typeof data.amount === 'number' ? Math.round(data.amount * 100) : undefined,
      providerReference: data.flw_ref ? String(data.flw_ref) : data.id ? String(data.id) : null,
    };
  }
}