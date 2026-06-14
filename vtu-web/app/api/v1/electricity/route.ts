// vtu-web/app/api/v1/electricity/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet, creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import { calculateFee } from '@/lib/fees/engine';
import { ok, err, parseIp } from '@/lib/utils/response';
import { Timestamp } from 'firebase-admin/firestore';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';
import {
  DISCOS,
  verifyMeter,
  purchaseElectricity,
  deliverElectricityToken,
  normaliseMeterNumber,
} from '@/lib/electricity/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const ElectricitySchema = z.object({
  meterNumber: z.string().min(6).max(20),
  disco: z.enum(DISCOS, {
    errorMap: () => ({ message: `disco must be one of: ${DISCOS.join(', ')}` }),
  }),
  type: z.enum(['prepaid', 'postpaid'], {
    errorMap: () => ({ message: "type must be 'prepaid' or 'postpaid'" }),
  }),
  amount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(500_00, 'Minimum electricity payment is ₦500')
    .max(500_000_00, 'Maximum electricity payment is ₦500,000'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  // Optional — frontend should call /api/v1/verify/meter first and pass this
  // through so we don't double-charge for verification, but we re-verify
  // server-side regardless to prevent stale/forged customer names.
  skipVerification: z.boolean().optional().default(false),
});

// ─── POST /api/v1/electricity ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = ElectricitySchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { meterNumber, disco, type, amount, transactionPin, idempotencyKey } = parsed.data;
  const normalisedMeter = normaliseMeterNumber(meterNumber);

  if (!/^\d{6,20}$/.test(normalisedMeter)) {
    return err('Meter number must contain only digits.', 422);
  }

  // 1. Load user + verify PIN + account status
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  if (!user.transactionPin) {
    return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');
  }
  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // 2. Verify meter before charging — prevents paying into a bad meter number
  let customerName: string;
  try {
    const meterInfo = await verifyMeter(normalisedMeter, disco, type);
    customerName = meterInfo.customerName;

    if (
      type === 'postpaid' &&
      meterInfo.outstandingBalanceKobo !== null &&
      amount < meterInfo.outstandingBalanceKobo
    ) {
      // Not a hard block — postpaid users can make partial payments —
      // but surface the outstanding balance so the frontend can warn.
    }
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this meter. Please check the meter number and try again.',
      400,
      'METER_VERIFICATION_FAILED'
    );
  }

  // 3. Calculate fee
  const feeCalc = await calculateFee('electricity', amount);
  const totalDebit = feeCalc.totalChargeKobo;

  // 4. Generate reference
  const reference = generateReference('electricity');
  const ip = parseIp(request);

  // 5. Debit wallet atomically (idempotency + fraud + spending limit checks)
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      totalDebit,
      {
        category: 'electricity',
        status: 'pending',
        reference,
        fee: feeCalc.platformFeeKobo + feeCalc.vatKobo,
        provider: null,
        metadata: {
          meterNumber: normalisedMeter,
          disco,
          meterType: type,
          customerName,
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
  let providerResult: ReturnType<typeof purchaseElectricity> extends Promise<infer T> ? T : never;
  try {
    providerResult = await purchaseElectricity({
      meterNumber: normalisedMeter,
      disco,
      type,
      amount,
      customerName,
      reference,
    });
  } catch {
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'failed',
      failureReason: 'Provider unreachable',
      updatedAt: Timestamp.now(),
    });

    return err(
      'Service temporarily unavailable. Your wallet will be refunded if the payment did not go through.',
      503
    );
  }

  // 7. Update transaction with provider outcome
  if (providerResult.success) {
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'success',
      provider: providerResult.provider,
      providerReference: providerResult.providerReference,
      metadata: {
        meterNumber: normalisedMeter,
        disco,
        meterType: type,
        customerName,
        requestedAmountKobo: amount,
        platformFeeKobo: feeCalc.platformFeeKobo,
        vatKobo: feeCalc.vatKobo,
        totalFeeKobo: feeCalc.totalFeeKobo,
        token: providerResult.token,
        units: providerResult.units,
        ip,
      },
      updatedAt: Timestamp.now(),
    });

    // Deliver token via SMS + email (non-blocking)
    deliverElectricityToken({
      userId: session.uid,
      token: providerResult.token,
      units: providerResult.units,
      disco,
      meterNumber: normalisedMeter,
      customerName,
      amountKobo: amount,
      reference,
    }).catch(console.error);

    return ok(
      {
        txnId,
        reference,
        status: 'success',
        meterNumber: normalisedMeter,
        disco,
        meterType: type,
        customerName,
        amountKobo: amount,
        feeKobo: feeCalc.totalFeeKobo,
        totalChargedKobo: totalDebit,
        token: providerResult.token,
        units: providerResult.units,
        providerReference: providerResult.providerReference,
        feeBreakdown: {
          platformFeeKobo: feeCalc.platformFeeKobo,
          vatKobo: feeCalc.vatKobo,
        },
      },
      providerResult.token
        ? 'Electricity purchased successfully. Your token has been sent.'
        : 'Electricity bill paid successfully.'
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
    await creditWallet(session.uid, totalDebit, {
      category: 'refund',
      status: 'success',
      reference: generateReference('refund'),
      metadata: { originalTxnId: txnId, reason: providerResult.error },
    });

    return err('Electricity payment failed. Your wallet has been refunded.', 400, 'PROVIDER_FAILED');
  }

  // Provider uncertain — don't refund; pending-tx-sweep cron will resolve
  return err('Payment could not be confirmed. We are investigating and will notify you.', 202, 'PENDING_RESOLUTION');
}

// ─── GET /api/v1/electricity — fee preview ────────────────────────────────────

/**
 * GET /api/v1/electricity?amount=500000
 * Returns the fee breakdown for an electricity payment at the given amount.
 * Called by the frontend checkout form before the user confirms.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const amountRaw = new URL(request.url).searchParams.get('amount');
  const amount = amountRaw ? parseInt(amountRaw, 10) : null;

  if (!amount || isNaN(amount) || amount <= 0) {
    return err('Provide a valid amount in kobo as a query param: ?amount=500000', 422);
  }

  const fee = await calculateFee('electricity', amount);

  return ok({
    amountKobo: amount,
    platformFeeKobo: fee.platformFeeKobo,
    vatKobo: fee.vatKobo,
    totalFeeKobo: fee.totalFeeKobo,
    totalChargeKobo: fee.totalChargeKobo,
    breakdown: fee.feeBreakdown,
  });
}