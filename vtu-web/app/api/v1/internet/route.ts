// vtu-web/app/api/v1/internet/route.ts
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
  INTERNET_PROVIDERS,
  verifyInternetAccount,
  listInternetPlans,
  getInternetPlanById,
  purchaseInternet,
  deliverInternetConfirmation,
  normaliseAccountNumber,
} from '@/lib/internet/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const PurchaseSchema = z.object({
  accountNumber: z.string().min(5).max(20),
  provider: z.enum(INTERNET_PROVIDERS, {
    errorMap: () => ({ message: `provider must be one of: ${INTERNET_PROVIDERS.join(', ')}` }),
  }),
  planId: z.string().min(1, 'Plan is required'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  skipVerification: z.boolean().optional().default(false),
});

// ─── POST /api/v1/internet — purchase / renew subscription ───────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { accountNumber, provider, planId, transactionPin, idempotencyKey } = parsed.data;
  const normalisedAccount = normaliseAccountNumber(accountNumber);

  if (!/^[A-Za-z0-9]{5,20}$/.test(normalisedAccount)) {
    return err('Account number must be alphanumeric.', 422);
  }

  // 1. Load user + verify PIN + account status
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);
  if (!user.transactionPin) return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');

  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // 2. Resolve plan
  const plan = await getInternetPlanById(planId);
  if (!plan) return err('Plan not found.', 404);
  if (!plan.isActive) return err('This plan is no longer available.', 400);
  if (plan.provider !== provider) return err('Plan provider does not match selected provider.', 400);

  // 3. Verify account — prevents paying onto an invalid account
  let customerName: string;
  try {
    const accountInfo = await verifyInternetAccount(normalisedAccount, provider);
    customerName = accountInfo.customerName;
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this account number. Please check it and try again.',
      400,
      'ACCOUNT_VERIFICATION_FAILED'
    );
  }

  // 4. Calculate fee
  const feeCalc = await calculateFee('internet', plan.priceKobo);
  const totalDebit = feeCalc.totalChargeKobo;

  const reference = generateReference('internet');
  const ip = parseIp(request);

  // 5. Debit wallet atomically
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      totalDebit,
      {
        category: 'internet',
        status: 'pending',
        reference,
        fee: feeCalc.platformFeeKobo + feeCalc.vatKobo,
        provider: null,
        metadata: {
          accountNumber: normalisedAccount,
          internetProvider: provider,
          customerName,
          planId: plan.id,
          planName: plan.name,
          dataLabel: plan.dataLabel,
          requestedAmountKobo: plan.priceKobo,
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
  let providerResult: Awaited<ReturnType<typeof purchaseInternet>>;
  try {
    providerResult = await purchaseInternet({
      accountNumber: normalisedAccount,
      provider,
      providerPlanId: plan.providerPlanId,
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
      updatedAt: Timestamp.now(),
    });

    deliverInternetConfirmation({
      userId: session.uid,
      provider,
      accountNumber: normalisedAccount,
      customerName,
      planName: plan.name,
      amountKobo: plan.priceKobo,
      reference,
    }).catch(console.error);

    return ok(
      {
        txnId,
        reference,
        status: 'success',
        accountNumber: normalisedAccount,
        provider,
        customerName,
        planName: plan.name,
        dataLabel: plan.dataLabel,
        amountKobo: plan.priceKobo,
        feeKobo: feeCalc.totalFeeKobo,
        totalChargedKobo: totalDebit,
        providerReference: providerResult.providerReference,
        feeBreakdown: {
          platformFeeKobo: feeCalc.platformFeeKobo,
          vatKobo: feeCalc.vatKobo,
        },
      },
      `${plan.name} subscription renewed successfully.`
    );
  }

  // Provider failure — refund if confirmed no charge
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

    return err('Internet subscription failed. Your wallet has been refunded.', 400, 'PROVIDER_FAILED');
  }

  return err('Payment could not be confirmed. We are investigating and will notify you.', 202, 'PENDING_RESOLUTION');
}

// ─── GET /api/v1/internet — plan catalogue OR fee preview ────────────────────

const ListQuerySchema = z.object({
  provider: z.enum(INTERNET_PROVIDERS, {
    errorMap: () => ({ message: `provider must be one of: ${INTERNET_PROVIDERS.join(', ')}` }),
  }),
});

const FeePreviewSchema = z.object({
  amount: z.coerce.number().int('Amount must be in kobo (integer)').positive(),
});

/**
 * GET /api/v1/internet?provider=smile     → { plans[] }
 * GET /api/v1/internet?amount=500000      → fee breakdown for checkout preview
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);

  if (searchParams.has('amount') && !searchParams.has('provider')) {
    const parsed = FeePreviewSchema.safeParse({ amount: searchParams.get('amount') });
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const fee = await calculateFee('internet', parsed.data.amount);
    return ok({
      amountKobo: parsed.data.amount,
      platformFeeKobo: fee.platformFeeKobo,
      vatKobo: fee.vatKobo,
      totalFeeKobo: fee.totalFeeKobo,
      totalChargeKobo: fee.totalChargeKobo,
      breakdown: fee.feeBreakdown,
    });
  }

  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const plans = await listInternetPlans(parsed.data.provider);
  return ok({ provider: parsed.data.provider, plans });
}