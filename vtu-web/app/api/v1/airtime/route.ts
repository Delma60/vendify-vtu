// vtu-web/app/api/v1/airtime/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { debitWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import { calculateFee } from '@/lib/fees/engine';
import { ok, err, parseIp } from '@/lib/utils/response';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';

// ─── Validation ───────────────────────────────────────────────────────────────

const AirtimeSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(['mtn', 'airtel', 'glo', '9mobile'], {
    message:"network must be mtn, airtel, glo, or 9mobile"
  }),
  amount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(10_00, 'Minimum airtime purchase is ₦10')
    .max(100_000_00, 'Maximum airtime purchase is ₦100,000'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

// ─── POST /api/v1/airtime ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  // 1. Parse + validate body
  const body = await request.json().catch(() => null);
  const parsed = AirtimeSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { phone, network, amount, transactionPin, idempotencyKey } = parsed.data;

  // 2. Load user + verify PIN + account status
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  if (!user.transactionPin) {
    return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');
  }
  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // 3. Calculate fee (checkout preview matches actual charge)
  const feeCalc = await calculateFee('airtime', amount);
  const totalDebit = feeCalc.totalChargeKobo; // amount + platformFee + VAT

  // 4. Generate reference
  const reference = generateReference('airtime');
  const ip = parseIp(request);

  // 5. Debit wallet atomically (includes idempotency + fraud + spending limit checks)
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      totalDebit,
      {
        category: 'airtime',
        status: 'pending',
        reference,
        fee: feeCalc.platformFeeKobo + feeCalc.vatKobo,
        provider: null,         // set after provider response
        metadata: {
          phone,
          network,
          requestedAmountKobo: amount,
          platformFeeKobo: feeCalc.platformFeeKobo,
          vatKobo: feeCalc.vatKobo,
          totalFeeKobo: feeCalc.totalFeeKobo,
          ip,
        },
      },
      idempotencyKey,
    );
  } catch (error) {
    const e = error as { code?: string; message: string };
    if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate request.', 409, e.code);
    if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance.', 400, e.code);
    if (e.code === 'SPENDING_LIMIT_EXCEEDED') return err(e.message, 400, e.code);
    if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Contact support.', 403, e.code);
    throw error;
  }

  // 6. Call provider router
  let providerResult: Awaited<ReturnType<typeof callProvider>>;
  try {
    providerResult = await callProvider({ phone, network, amount, reference });
  } catch {
    // Provider completely unreachable — update status but don't refund yet
    // (dead letter queue / pending-tx-sweep cron handles retry + refund)
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'failed',
      failureReason: 'Provider unreachable',
      updatedAt: Timestamp.now(),
    });

    return err('Service temporarily unavailable. Your wallet will be refunded if the purchase did not go through.', 503);
  }

  // 7. Update transaction with provider outcome
  if (providerResult.success) {
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'success',
      provider: providerResult.provider,
      providerReference: providerResult.providerReference,
      updatedAt: Timestamp.now(),
    });

    return ok(
      {
        txnId,
        reference,
        status: 'success',
        phone,
        network,
        amountKobo: amount,
        feeKobo: feeCalc.totalFeeKobo,
        totalChargedKobo: totalDebit,
        providerReference: providerResult.providerReference,
        feeBreakdown: {
          platformFeeKobo: feeCalc.platformFeeKobo,
          vatKobo: feeCalc.vatKobo,
        },
      },
      'Airtime purchased successfully.'
    );
  }

  // Provider returned a failure — refund if provider confirms no charge
  await adminDb.collection('transactions').doc(txnId).update({
    status: 'failed',
    provider: providerResult.provider,
    failureReason: providerResult.error,
    updatedAt: Timestamp.now(),
  });

  if (providerResult.shouldRefund) {
    const { creditWallet } = await import('@/lib/wallet/operations');
    await creditWallet(session.uid, totalDebit, {
      category: 'refund',
      status: 'success',
      reference: generateReference('refund'),
      metadata: { originalTxnId: txnId, reason: providerResult.error },
    });

    return err('Airtime purchase failed. Your wallet has been refunded.', 400, 'PROVIDER_FAILED');
  }

  // Provider uncertain — don't refund; pending-tx-sweep cron will resolve
  return err('Purchase could not be confirmed. We are investigating and will notify you.', 202, 'PENDING_RESOLUTION');
}

// ─── GET /api/v1/airtime — fee preview ───────────────────────────────────────

/**
 * GET /api/v1/airtime?amount=500000
 * Returns the fee breakdown for an airtime purchase at the given amount.
 * Called by the frontend checkout form before the user confirms.
 */
export async function GET(request: NextRequest) {
  try{
    const session = await getSession();
    const user = await auth();
    if (!session) return err('Unauthorized', 401);
  
    const amountRaw = new URL(request.url).searchParams.get('amount');
    const network = new URL(request.url).searchParams.get('network') as string;
    const amount = amountRaw ? parseInt(amountRaw, 10) : null;
  
    if (!amount || isNaN(amount) || amount <= 0) {
      return err('Provide a valid amount in kobo as a query param: ?amount=50000', 422);
    }
    console.log(user)
    // getRole

  
    const fee = await calculateFee('airtime', user, amount, network);
  
    return ok({
      // discount: ,
      amountKobo: amount,
      platformFeeKobo: fee.platformFeeKobo,
      vatKobo: fee.vatKobo,
      totalFeeKobo: fee.totalFeeKobo,
      totalChargeKobo: fee.totalChargeKobo,
      breakdown: fee.feeBreakdown,
    });

  }catch(e){
    console.log(e)
    return err("internal error occured")
  }
}

// ─── Provider call (wraps router) ─────────────────────────────────────────────

interface ProviderCallParams {
  phone: string;
  network: string;
  amount: number;   // kobo — convert to naira inside router if needed
  reference: string;
}

interface ProviderCallResult {
  success: boolean;
  provider: string;
  providerReference: string;
  error?: string;
  shouldRefund?: boolean;
}

async function callProvider(params: ProviderCallParams): Promise<ProviderCallResult> {
  // Dynamic import keeps the provider router out of the edge bundle
  const { buyAirtime } = await import('@/lib/providers/router');

  const result = await buyAirtime({
    phone: params.phone,
    network: params.network,
    amount: params.amount,
    reference: params.reference,
  });

  return {
    success: result.success,
    provider: result.provider ?? 'unknown',
    providerReference: result.providerReference ?? '',
    error: result.error,
    shouldRefund: result.shouldRefund,
  };
}