// vtu-web/lib/flutterwave/virtual-accounts.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #14 (runtime config)

import * as FlutterwaveClient from './client';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logExternalCall } from '@/lib/utils/logger';

export interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  accountReference: string;
  accountName: string;
  createdAt: string;
}

export interface VirtualAccountPaymentVerification {
  verified: boolean;
  amount: number;           // in kobo
  reference: string;
  narration: string;
  paidAt: string | null;
}

// ─── CREATE VIRTUAL ACCOUNT ────────────────────────────────────────────────────

/**
 * Create a Flutterwave dedicated virtual account (NUBAN) for a user.
 * Called once on user registration.
 */
export async function createVirtualAccount(
  userId: string,
  customerDetails: { email: string; phone: string; name: string }
): Promise<VirtualAccount> {
  const payload = {
    email: customerDetails.email,
    is_permanent: true,
    bvn: '',               // optional: populate if user has completed KYC
    tx_ref: `VA-${userId}-${Date.now()}`,
    phonenumber: customerDetails.phone.startsWith('+')
      ? customerDetails.phone
      : `+234${customerDetails.phone.replace(/^0/, '')}`,
    firstname: customerDetails.name.split(' ')[0] ?? customerDetails.name,
    lastname: customerDetails.name.split(' ').slice(1).join(' ') || customerDetails.name,
    narration: `${customerDetails.name} | VendPro Wallet`,
  };

  const response = await FlutterwaveClient.post(
    '/v3/virtual-account-numbers',
    JSON.stringify(payload)
  );

  if (response.status !== 'success' || !response.data) {
    logExternalCall('Flutterwave', 'createVirtualAccount', payload, response, false);
    throw new Error(`Failed to create virtual account: ${response.message}`);
  }

  const data = response.data as {
    account_number: string;
    bank_name: string;
    ref: string;
    account_name: string;
    created_at: string;
  };

  const virtualAccount: VirtualAccount = {
    accountNumber: data.account_number,
    bankName: data.bank_name,
    accountReference: data.ref,
    accountName: data.account_name,
    createdAt: data.created_at,
  };

  // Persist to wallet document
  await adminDb.collection('wallets').doc(userId).update({
    virtualAccountNumber: virtualAccount.accountNumber,
    virtualAccountBank: virtualAccount.bankName,
    virtualAccountRef: virtualAccount.accountReference,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logExternalCall('Flutterwave', 'createVirtualAccount', payload, data, true);

  return virtualAccount;
}

// ─── GET VIRTUAL ACCOUNT DETAILS ──────────────────────────────────────────────

export async function getVirtualAccountDetails(
  orderRef: string
): Promise<VirtualAccount | null> {
  const response = await FlutterwaveClient.get(
    `/v3/virtual-account-numbers/${orderRef}`
  );

  if (response.status !== 'success' || !response.data) {
    return null;
  }

  const data = response.data as {
    account_number: string;
    bank_name: string;
    ref: string;
    account_name: string;
    created_at: string;
  };

  return {
    accountNumber: data.account_number,
    bankName: data.bank_name,
    accountReference: data.ref,
    accountName: data.account_name,
    createdAt: data.created_at,
  };
}

// ─── VERIFY VIRTUAL ACCOUNT PAYMENT ───────────────────────────────────────────

export async function verifyVirtualAccountPayment(
  reference: string
): Promise<VirtualAccountPaymentVerification> {
  const response = await FlutterwaveClient.get(
    `/v3/transactions?tx_ref=${encodeURIComponent(reference)}`
  );

  if (response.status !== 'success') {
    return { verified: false, amount: 0, reference, narration: '', paidAt: null };
  }

  const txns = (response.data as { data: unknown[] })?.data ?? [];
  const txn = txns[0] as {
    status: string;
    amount: number;
    currency: string;
    narration: string;
    created_at: string;
  } | undefined;

  if (!txn || txn.status !== 'successful') {
    return { verified: false, amount: 0, reference, narration: '', paidAt: null };
  }

  // Flutterwave returns amounts in Naira — convert to kobo
  const amountKobo = Math.round(txn.amount * 100);

  return {
    verified: true,
    amount: amountKobo,
    reference,
    narration: txn.narration,
    paidAt: txn.created_at,
  };
}