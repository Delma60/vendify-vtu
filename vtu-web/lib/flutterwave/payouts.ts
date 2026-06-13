// vtu-web/lib/flutterwave/payouts.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #11 (test with emulator)

import * as FlutterwaveClient from './client';
import { logExternalCall } from '@/lib/utils/logger';

export interface PayoutRecipient {
  recipientId: string;
  name: string;
  accountNumber: string;
  bankCode: string;
}

export interface PayoutResponse {
  status: 'success' | 'error';
  data: unknown;
  message: string;
}

export interface PayoutStatus {
  id: string;
  status: 'NEW' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: number;
  currency: string;
  reference: string;
  narration: string;
  completedAt: string | null;
}

// ─── CREATE PAYOUT RECIPIENT ───────────────────────────────────────────────────

export async function createPayoutRecipient(recipientData: {
  name: string;
  accountNumber: string;
  bankCode: string | number;
  currency: string;
}): Promise<PayoutResponse> {
  const payload = {
    name: recipientData.name,
    account_number: recipientData.accountNumber,
    bank_code: recipientData.bankCode,
    currency: recipientData.currency,
  };

  try {
    const response = await FlutterwaveClient.post(
      '/v3/payout-batch/beneficiaries',
      JSON.stringify(payload)
    );

    if (response.status === 'success' && response.data) {
      const b = response.data as Record<string, unknown>;
      return {
        status: 'success',
        data: {
          recipientId: b.id,
          name: b.name,
          accountNumber: b.account_number,
          bankCode: b.bank_code,
        },
        message: 'Payout recipient created successfully',
      };
    }

    throw new Error(`Failed to create payout recipient: ${response.message}`);
  } catch (error) {
    const e = error as Error;
    throw new Error(`Error creating payout recipient: ${e.message}`);
  }
}

// ─── INITIATE PAYOUT ──────────────────────────────────────────────────────────

/**
 * Send a payout via Flutterwave Transfers API.
 * amount must be in NAIRA (Flutterwave does not use kobo).
 * Convert before calling: amountNaira = amountKobo / 100
 */
export async function initiatePayout(
  amountNaira: number,
  currency: string,
  bankCode: string,
  accountNumber: string,
  accountName: string,
  reference: string,
  narration: string,
  metadata: Record<string, unknown> = {}
): Promise<PayoutResponse> {
  const payload = {
    account_bank: bankCode,
    account_number: accountNumber,
    amount: amountNaira,
    currency,
    narration,
    reference,
    beneficiary_name: accountName,
    meta: metadata,
  };

  const startTime = Date.now();

  try {
    const response = await FlutterwaveClient.post('/v3/transfers', JSON.stringify(payload));
    const duration = Date.now() - startTime;

    logExternalCall('Flutterwave', '/v3/transfers', payload, response, response.status === 'success');

    if (response.status === 'success' && response.data) {
      const d = response.data as Record<string, unknown>;
      return {
        status: 'success',
        data: {
          id: d.id,
          reference: d.reference,
          status: d.status,
          amount: d.amount,
          currency: d.currency,
          completedAt: d.complete_message,
        },
        message: 'Payout initiated successfully',
      };
    }

    return {
      status: 'error',
      data: null,
      message: response.message ?? 'Payout initiation failed',
    };
  } catch (error) {
    const e = error as Error;
    logExternalCall('Flutterwave', '/v3/transfers', payload, { error: e.message }, false);
    throw new Error(`Payout initiation error: ${e.message}`);
  }
}

// ─── GET PAYOUT STATUS ────────────────────────────────────────────────────────

export async function getPayoutStatus(flwTransferId: string): Promise<PayoutStatus> {
  try {
    const response = await FlutterwaveClient.get(`/v3/transfers/${flwTransferId}`);

    if (response.status !== 'success' || !response.data) {
      throw new Error(`Failed to fetch payout status: ${response.message}`);
    }

    const d = response.data as Record<string, unknown>;
    return {
      id: String(d.id),
      status: d.status as PayoutStatus['status'],
      amount: Number(d.amount),
      currency: String(d.currency),
      reference: String(d.reference),
      narration: String(d.narration),
      completedAt: (d.complete_message as string | null) ?? null,
    };
  } catch (error) {
    const e = error as Error;
    throw new Error(`Error fetching payout status: ${e.message}`);
  }
}

// ─── GET PAYOUT STATUS BY REFERENCE ──────────────────────────────────────────

export async function getPayoutStatusByReference(reference: string): Promise<PayoutStatus | null> {
  try {
    const response = await FlutterwaveClient.get(
      `/v3/transfers?reference=${encodeURIComponent(reference)}`
    );

    if (response.status !== 'success' || !response.data) return null;

    const list = (response.data as { data: unknown[] })?.data ?? [];
    if (!list.length) return null;

    const d = list[0] as Record<string, unknown>;
    return {
      id: String(d.id),
      status: d.status as PayoutStatus['status'],
      amount: Number(d.amount),
      currency: String(d.currency),
      reference: String(d.reference),
      narration: String(d.narration),
      completedAt: (d.complete_message as string | null) ?? null,
    };
  } catch (error) {
    return null;
  }
}

// ─── LIST BANKS ───────────────────────────────────────────────────────────────

export interface Bank {
  id: number;
  code: string;
  name: string;
}

export async function listBanks(country = 'NG'): Promise<Bank[]> {
  try {
    const response = await FlutterwaveClient.get(`/v3/banks/${country}`);
    if (response.status !== 'success' || !response.data) return [];

    const list = (response.data as unknown[]) ?? [];
    return list.map((b) => {
      const bank = b as Record<string, unknown>;
      return {
        id: Number(bank.id),
        code: String(bank.code),
        name: String(bank.name),
      };
    });
  } catch {
    return [];
  }
}