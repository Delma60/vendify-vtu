// vtu-web/app/api/v1/electricity/split/[splitId]/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet, creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import { ok, err } from '@/lib/utils/response';
import { Timestamp } from 'firebase-admin/firestore';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';
import { getBillSplit, markSplitSharePaid, declineBillSplit, DISCO_LABELS } from '@/lib/electricity/engine';

type RouteContext = { params: { splitId: string } };

// ─── Validation ───────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  action: z.enum(['pay', 'decline']),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits').optional(),
  idempotencyKey: z.string().min(1).optional(),
}).refine(
  d => d.action !== 'pay' || (!!d.transactionPin && !!d.idempotencyKey),
  { message: 'transactionPin and idempotencyKey are required to pay your share', path: ['transactionPin'] }
);

// ─── GET /api/v1/electricity/split/:splitId — fetch a single split ───────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const split = await getBillSplit(params.splitId);
  if (!split) return err('Bill split not found', 404);

  if (split.initiatorId !== session.uid && split.partnerId !== session.uid) {
    return err('You are not part of this bill split', 403);
  }

  return ok({
    split,
    discoLabel: DISCO_LABELS[split.disco],
    yourShareKobo: split.initiatorId === session.uid ? split.initiatorShareKobo : split.partnerShareKobo,
    yourPaid: split.initiatorId === session.uid ? split.initiatorPaid : split.partnerPaid,
  });
}

// ─── POST /api/v1/electricity/split/:splitId — pay your share or decline ─────

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { action } = parsed.data;

  const split = await getBillSplit(params.splitId);
  if (!split) return err('Bill split not found', 404);

  if (split.initiatorId !== session.uid && split.partnerId !== session.uid) {
    return err('You are not part of this bill split', 403);
  }

  if (split.status !== 'pending' && split.status !== 'accepted') {
    return err(`This bill split is already ${split.status}.`, 400);
  }

  if (Date.now() > split.expiresAt.toMillis()) {
    return err('This bill split request has expired.', 400, 'SPLIT_EXPIRED');
  }

  // ── Decline ──────────────────────────────────────────────────────────────
  if (action === 'decline') {
    try {
      await declineBillSplit(params.splitId, session.uid);
      return ok({ splitId: params.splitId, status: 'declined' }, 'Bill split declined.');
    } catch (e: any) {
      return err(e.message, 400);
    }
  }

  // ── Pay share ────────────────────────────────────────────────────────────
  const { transactionPin, idempotencyKey } = parsed.data;

  const isInitiator = split.initiatorId === session.uid;
  const alreadyPaid = isInitiator ? split.initiatorPaid : split.partnerPaid;
  if (alreadyPaid) return err('You have already paid your share.', 400);

  const shareKobo = isInitiator ? split.initiatorShareKobo : split.partnerShareKobo;

  // Load user + verify PIN
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);
  if (!user.transactionPin) return err('Please set a transaction PIN before paying.', 400, 'NO_PIN');

  const pinValid = await bcrypt.compare(transactionPin!, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Debit the payer's share into a holding category. The actual electricity
  // purchase is only triggered once both shares are collected (see engine).
  let txnId: string;
  try {
    txnId = await debitWallet(
      session.uid,
      shareKobo,
      {
        category: 'bucket_purchase', // closest existing category for held funds; metadata clarifies intent
        status: 'success',
        reference: generateReference('electricity'),
        provider: null,
        metadata: {
          type: 'electricity_bill_split_share',
          splitId: params.splitId,
          disco: split.disco,
          meterNumber: split.meterNumber,
          meterType: split.meterType,
          customerName: split.customerName,
          shareKobo,
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

  try {
    const updated = await markSplitSharePaid(params.splitId, session.uid);

    return ok(
      {
        splitId: params.splitId,
        status: updated.status,
        txnId,
        bothPaid: updated.initiatorPaid && updated.partnerPaid,
        token: null as string | null,
      },
      updated.status === 'paid'
        ? 'Both shares collected — electricity payment has been processed and your token has been sent.'
        : 'Your share has been paid. Waiting for the other party to pay theirs.'
    );
  } catch (e: any) {
    // markSplitSharePaid failed after we already debited — refund immediately
    await creditWallet(session.uid, shareKobo, {
      category: 'refund',
      status: 'success',
      reference: generateReference('refund'),
      metadata: { originalTxnId: txnId, reason: 'Bill split processing failed', splitId: params.splitId },
    });

    await adminDb.collection('transactions').doc(txnId).update({
      status: 'reversed',
      failureReason: e.message,
      updatedAt: Timestamp.now(),
    });

    return err(e.message, 400);
  }
}