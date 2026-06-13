// vtu-web/app/api/v1/wallet/withdraw/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet } from '@/lib/wallet/operations';
import { ok, err } from '@/lib/utils/response';
import { generateReference } from '@/lib/utils/reference';
import { post as flwPost } from '@/lib/flutterwave/client';
import { Timestamp } from 'firebase-admin/firestore';
import { parseIp } from '@/lib/utils/response';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const WithdrawSchema = z.object({
  amount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(1, 'Amount must be positive'),
  accountNumber: z.string().min(10).max(10),
  bankCode: z.string().min(2).max(10),
  accountName: z.string().min(2),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1),
  narration: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = WithdrawSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const {
    amount, accountNumber, bankCode, accountName,
    transactionPin, idempotencyKey, narration,
  } = parsed.data;

  // Load user
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);

  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) {
    return err('Account is restricted. Please contact support.', 403);
  }

  // Verify transaction PIN
  if (!user.transactionPin) {
    return err('Please set a transaction PIN before withdrawing.', 400, 'NO_PIN');
  }

  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Load system settings for minimum withdrawal and fee
  const settingsSnap = await adminDb.collection('system_settings').doc('global').get();
  const settings = settingsSnap.data() as {
    minimumWithdrawalAmount: number;
    withdrawalFee: number;
    withdrawalFeeType: 'flat' | 'percentage';
  } | undefined;

  const minWithdrawal = settings?.minimumWithdrawalAmount ?? 50_000; // ₦500 default
  if (amount < minWithdrawal) {
    return err(
      `Minimum withdrawal amount is ₦${(minWithdrawal / 100).toFixed(0)}`,
      400,
      'BELOW_MINIMUM'
    );
  }

  // Calculate fee
  let fee = 0;
  if (settings) {
    fee = settings.withdrawalFeeType === 'flat'
      ? settings.withdrawalFee
      : Math.round(amount * (settings.withdrawalFee / 100));
  }

  const totalDebit = amount + fee;
  const reference = generateReference('withdrawal');
  const ip = parseIp(request);

  // Debit wallet atomically
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      totalDebit,
      {
        category: 'withdrawal',
        status: 'pending',
        reference,
        fee,
        provider: 'flutterwave',
        metadata: { accountNumber, bankCode, accountName, narration, ip },
      },
      idempotencyKey,
    );
  } catch (error) {
    const e = error as { code?: string; message: string };
    if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate withdrawal request', 409, e.code);
    if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance', 400, e.code);
    if (e.code === 'SPENDING_LIMIT_EXCEEDED') return err(e.message, 400, e.code);
    if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Please contact support.', 403, e.code);
    throw error;
  }

  // Initiate Flutterwave transfer
  const amountNaira = amount / 100;
  const flwPayload = {
    account_bank: bankCode,
    account_number: accountNumber,
    amount: amountNaira,
    currency: 'NGN',
    narration: narration ?? `Withdrawal - ${reference}`,
    reference,
    beneficiary_name: accountName,
    meta: { txnId, userId: session.uid },
  };

  const flwResponse = await flwPost('/v3/transfers', JSON.stringify(flwPayload));

  if (flwResponse.status !== 'success') {
    // Flutterwave rejected it — refund wallet
    const { creditWallet } = await import('@/lib/wallet/operations');
    await creditWallet(session.uid, totalDebit, {
      category: 'refund',
      status: 'success',
      reference: generateReference('refund'),
      metadata: { originalTxnId: txnId, reason: 'Withdrawal initiation failed' },
    });

    await adminDb.collection('transactions').doc(txnId).update({
      status: 'failed',
      failureReason: flwResponse.message,
      updatedAt: Timestamp.now(),
    });

    return err('Withdrawal failed to initiate. Funds have been reversed.', 502);
  }

  const flwData = flwResponse.data as { id: number; reference: string };

  // Update transaction with provider reference
  await adminDb.collection('transactions').doc(txnId).update({
    status: 'pending',
    providerReference: String(flwData.id),
    updatedAt: Timestamp.now(),
  });

  return ok({
    txnId,
    reference,
    status: 'pending',
    amount,
    fee,
    totalDeducted: totalDebit,
    message: 'Withdrawal initiated. Funds will be transferred within 24 hours.',
  });
}