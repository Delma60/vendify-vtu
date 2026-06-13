// vtu-web/app/api/v1/wallet/transfer/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { debitWallet, creditWallet } from '@/lib/wallet/operations';
import { ok, err } from '@/lib/utils/response';
import { generateReference } from '@/lib/utils/reference';
import { parseIp } from '@/lib/utils/response';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const TransferSchema = z.object({
  recipientIdentifier: z.string().min(1, 'Recipient email, phone, or referral code required'),
  amount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(100_00, 'Minimum transfer is ₦100'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
  idempotencyKey: z.string().min(1),
  narration: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = TransferSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { recipientIdentifier, amount, transactionPin, idempotencyKey, narration } = parsed.data;

  if (!recipientIdentifier) return err('Recipient is required', 400);

  // Load sender
  const senderSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!senderSnap.exists) return err('User not found', 404);
  const sender = senderSnap.data() as User;

  if (!sender.isActive || sender.isFrozen) {
    return err('Account is restricted.', 403);
  }

  // Verify PIN
  if (!sender.transactionPin) {
    return err('Please set a transaction PIN before transferring.', 400, 'NO_PIN');
  }
  const pinValid = await bcrypt.compare(transactionPin, sender.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Resolve recipient by email, phone, or referral code
  const recipientSnap = await resolveRecipient(recipientIdentifier);
  if (!recipientSnap) return err('Recipient not found.', 404, 'RECIPIENT_NOT_FOUND');

  const recipientId = recipientSnap.id;
  const recipient = recipientSnap.data() as User;

  if (recipientId === session.uid) {
    return err('You cannot transfer to yourself.', 400);
  }
  if (!recipient.isActive) {
    return err('Recipient account is inactive.', 400);
  }

  const ip = parseIp(request);
  const senderRef = generateReference('transfer');
  const recipientRef = generateReference('transfer');

  // Debit sender
  let senderTxnId: string;
  try {
    senderTxnId = await debitWallet(
      session.uid,
      amount,
      {
        category: 'transfer',
        status: 'success',
        reference: senderRef,
        provider: null,
        metadata: {
          toUserId: recipientId,
          toDisplayName: recipient.displayName,
          narration: narration ?? '',
          ip,
        },
      },
      idempotencyKey,
    );
  } catch (error) {
    const e = error as { code?: string; message: string };
    if (e.code === 'DUPLICATE_TRANSACTION') return err('Duplicate transfer request', 409, e.code);
    if (e.code === 'INSUFFICIENT_FUNDS') return err('Insufficient wallet balance', 400, e.code);
    if (e.code === 'SPENDING_LIMIT_EXCEEDED') return err(e.message, 400, e.code);
    if (e.code === 'FRAUD_BLOCKED') return err('Transaction blocked. Contact support.', 403, e.code);
    throw error;
  }

  // Credit recipient
  const recipientTxnId = await creditWallet(recipientId, amount, {
    category: 'transfer',
    status: 'success',
    reference: recipientRef,
    provider: null,
    metadata: {
      fromUserId: session.uid,
      fromDisplayName: sender.displayName,
      narration: narration ?? '',
      pairTxnId: senderTxnId,
    },
  });

  return ok({
    senderTxnId,
    recipientTxnId,
    reference: senderRef,
    amount,
    recipientName: recipient.displayName,
    status: 'success',
  });
}

async function resolveRecipient(identifier: string) {
  // Try email
  const emailSnap = await adminDb
    .collection('users')
    .where('email', '==', identifier.toLowerCase())
    .limit(1)
    .get();
  if (!emailSnap.empty) return emailSnap.docs[0];

  // Try phone
  const phoneSnap = await adminDb
    .collection('users')
    .where('phone', '==', identifier)
    .limit(1)
    .get();
  if (!phoneSnap.empty) return phoneSnap.docs[0];

  // Try referral code
  const refSnap = await adminDb
    .collection('users')
    .where('referralCode', '==', identifier.toUpperCase())
    .limit(1)
    .get();
  if (!refSnap.empty) return refSnap.docs[0];

  return null;
}