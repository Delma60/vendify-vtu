// vtu-web/app/api/v1/data/gift/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import { calculateFee } from '@/lib/fees/engine';
import { ok, err, parseIp } from '@/lib/utils/response';
import { getDataPlanById, createDataGift, markGiftDelivered } from '@/lib/data/engine';
import { Timestamp } from 'firebase-admin/firestore';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const;

const GiftSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string().min(1, 'Recipient name is required').max(60),
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(NETWORKS),
  planId: z.string().min(1, 'Plan ID is required'),
  personalMessage: z.string().max(200).optional(),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

/**
 * POST /api/v1/data/gift
 * Buy a data bundle as a gift for someone. The recipient receives an email
 * with the gift details and a personalised message.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = GiftSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const {
    recipientEmail,
    recipientName,
    phone,
    network,
    planId,
    personalMessage,
    transactionPin,
    idempotencyKey,
  } = parsed.data;

  // Load sender
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);
  if (!user.transactionPin) return err('Please set a transaction PIN before gifting.', 400, 'NO_PIN');

  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Validate plan
  const plan = await getDataPlanById(planId);
  if (!plan) return err('Data plan not found.', 404);
  if (!plan.isActive) return err('This data plan is no longer available.', 400);
  if (plan.network !== network) return err('Plan network does not match selected network.', 400);

  // Cannot gift to self (same phone); not strictly enforced — just best effort
  const feeCalc = await calculateFee('data', plan.priceKobo);
  const totalDebit = feeCalc.totalChargeKobo;
  const reference = generateReference('data');
  const ip = parseIp(request);

  // Debit sender wallet
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      totalDebit,
      {
        category: 'data',
        status: 'pending',
        reference,
        fee: feeCalc.totalFeeKobo,
        provider: null,
        metadata: {
          phone,
          network,
          planId,
          planName: plan.name,
          sizeLabel: plan.size,
          isGift: true,
          recipientEmail,
          recipientName,
          personalMessage: personalMessage ?? null,
          ip,
        },
      },
      idempotencyKey
    );
  } catch (error) {
    const e = error as { code?: string; message: string };
    if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate request.', 409, e.code);
    if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance.', 400, e.code);
    if (e.code === 'SPENDING_LIMIT_EXCEEDED') return err(e.message, 400, e.code);
    if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Contact support.', 403, e.code);
    throw error;
  }

  // Create gift record
  const giftId = await createDataGift(session.uid, {
    recipientEmail,
    recipientName,
    phone,
    network,
    planId,
    personalMessage,
    transactionId: txnId,
  });

  // Call provider
  let providerResult: { success: boolean; provider: string; providerReference: string; error?: string; shouldRefund?: boolean };
  try {
    const { buyData } = await import('@/lib/providers/router');
    const result = await buyData({
      phone,
      network,
      planId: plan.providerPlanId,
      amount: plan.priceKobo,
      reference,
    });
    providerResult = {
      success: result.success,
      provider: result.provider ?? 'unknown',
      providerReference: result.providerReference ?? '',
      error: result.error,
      shouldRefund: result.shouldRefund,
    };
  } catch {
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'failed',
      failureReason: 'Provider unreachable',
      updatedAt: Timestamp.now(),
    });
    return err('Service temporarily unavailable. Your wallet will be refunded if the purchase did not go through.', 503);
  }

  if (providerResult.success) {
    await adminDb.collection('transactions').doc(txnId).update({
      status: 'success',
      provider: providerResult.provider,
      providerReference: providerResult.providerReference,
      updatedAt: Timestamp.now(),
    });

    await markGiftDelivered(giftId);

    // Send gift email (non-blocking)
    sendGiftEmail({
      senderName: user.displayName,
      recipientEmail,
      recipientName,
      phone,
      network,
      planName: plan.name,
      sizeLabel: plan.size,
      validityLabel: plan.validity,
      personalMessage: personalMessage ?? null,
    }).catch(console.error);

    return ok({
      txnId,
      giftId,
      reference,
      status: 'success',
      phone,
      network,
      planName: plan.name,
      sizeLabel: plan.size,
      recipientEmail,
      recipientName,
      totalChargedKobo: totalDebit,
    }, `Data gift sent to ${recipientName}!`);
  }

  // Provider failed
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
    return err('Data gift failed. Your wallet has been refunded.', 400, 'PROVIDER_FAILED');
  }

  return err('Gift could not be confirmed. We are investigating and will notify you.', 202, 'PENDING_RESOLUTION');
}

// ─── Gift email ───────────────────────────────────────────────────────────────

async function sendGiftEmail(opts: {
  senderName: string;
  recipientEmail: string;
  recipientName: string;
  phone: string;
  network: string;
  planName: string;
  sizeLabel: string;
  validityLabel: string;
  personalMessage: string | null;
}): Promise<void> {
  const { sendMail } = await import('@/lib/mail/client');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: opts.recipientEmail,
    subject: `🎁 ${opts.senderName} just sent you ${opts.sizeLabel} of data!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2>You've received a data gift! 🎁</h2>
        <p>Hi ${opts.recipientName},</p>
        <p><strong>${opts.senderName}</strong> has gifted you ${opts.sizeLabel} of mobile data
        on <strong>${opts.network.toUpperCase()}</strong>.</p>

        ${opts.personalMessage ? `
        <div style="background:#f9fafb;border-left:4px solid #6366f1;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0">
          <p style="margin:0;font-style:italic;color:#374151">"${opts.personalMessage}"</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">— ${opts.senderName}</p>
        </div>` : ''}

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Network</td>
            <td style="padding:8px;font-weight:600;text-transform:uppercase">${opts.network}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Phone number</td>
            <td style="padding:8px">${opts.phone}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Data plan</td>
            <td style="padding:8px;font-weight:600">${opts.planName} (${opts.sizeLabel})</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Validity</td>
            <td style="padding:8px">${opts.validityLabel}</td>
          </tr>
        </table>

        <p style="color:#6b7280;font-size:13px">
          The data has been loaded directly onto your phone number. Dial *123# or check your
          network's balance code to confirm.
        </p>

        <p style="color:#6b7280;font-size:12px">
          Powered by <a href="${appUrl}" style="color:#6366f1">${appName}</a>
        </p>
      </div>
    `,
    text: `${opts.senderName} sent you ${opts.sizeLabel} of ${opts.network.toUpperCase()} data (${opts.planName}, valid for ${opts.validityLabel}) on ${opts.phone}.${opts.personalMessage ? ` Message: "${opts.personalMessage}"` : ''}`,
  });
}