// vtu-web/lib/flutterwave/webhooks.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #5 (idempotency)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyWebhookSignature } from '@/lib/flutterwave/client';
import { creditWallet } from '@/lib/wallet/operations';
import { generateReference } from '@/lib/utils/reference';
import { logExternalCall } from '@/lib/utils/logger';

interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      email: string;
      phone_number: string | null;
      name: string;
    };
    meta?: {
      userId?: string;
      [key: string]: unknown;
    };
  };
}

// ─── MAIN WEBHOOK HANDLER ─────────────────────────────────────────────────────

/**
 * Validate and process an incoming Flutterwave webhook event.
 * Throws on invalid signature or unrecoverable processing errors.
 */
export async function handleFlutterwaveWebhook(
  rawBody: string,
  signature: string
): Promise<void> {
  // 1. Validate signature
  const parsed = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
  const isValid = await verifyWebhookSignature(parsed, signature);

  if (!isValid) {
    logExternalCall('Flutterwave', 'webhook:signature-fail', { signature }, null, false);
    throw new Error('Invalid webhook signature');
  }

  const { event, data } = parsed;

  logExternalCall('Flutterwave', `webhook:${event}`, parsed, null, true);

  // 2. Deduplicate — store processed webhook IDs
  const webhookId = `FLW-${data.id}`;
  const webhookRef = adminDb.collection('processed_webhooks').doc(webhookId);
  const existing = await webhookRef.get();

  if (existing.exists) {
    // Already processed — idempotent, do nothing
    return;
  }

  // 3. Mark as processing immediately to prevent concurrent duplicates
  await webhookRef.set({
    webhookId,
    event,
    flwRef: data.flw_ref,
    txRef: data.tx_ref,
    status: 'processing',
    processedAt: FieldValue.serverTimestamp(),
  });

  try {
    await processWebhookEvent(event, data);

    // Mark as done
    await webhookRef.update({ status: 'completed' });
  } catch (error) {
    await webhookRef.update({
      status: 'failed',
      error: (error as Error).message,
    });
    throw error;
  }
}

// ─── EVENT DISPATCHER ─────────────────────────────────────────────────────────

async function processWebhookEvent(
  event: string,
  data: FlutterwaveWebhookPayload['data']
): Promise<void> {
  switch (event) {
    case 'charge.completed':
      if (data.status === 'successful') {
        await handleSuccessfulCharge(data);
      }
      break;

    case 'transfer.completed':
      await handleTransferCompleted(data);
      break;

    case 'virtual_account.credited':
      if (data.status === 'successful') {
        await handleSuccessfulCharge(data);
      }
      break;

    default:
      // Unknown event — log and ignore
      logExternalCall('Flutterwave', `webhook:unknown-event:${event}`, data, null, false);
  }
}

// ─── SUCCESSFUL PAYMENT → WALLET CREDIT ──────────────────────────────────────

async function handleSuccessfulCharge(
  data: FlutterwaveWebhookPayload['data']
): Promise<void> {
  // Resolve userId from tx_ref or metadata
  const userId = await resolveUserId(data);
  if (!userId) {
    logExternalCall('Flutterwave', 'webhook:unresolved-user', data, null, false);
    return;
  }

  // Flutterwave sends NGN amounts — convert to kobo
  if (data.currency !== 'NGN') {
    logExternalCall('Flutterwave', 'webhook:unsupported-currency', data, null, false);
    return;
  }

  const amountKobo = Math.round(data.amount * 100);

  const txnId = await creditWallet(userId, amountKobo, {
    category: 'wallet_fund',
    status: 'success',
    reference: generateReference('wallet_fund'),
    providerReference: data.flw_ref,
    provider: 'flutterwave',
    metadata: {
      paymentType: data.payment_type,
      flwTxRef: data.tx_ref,
      customerEmail: data.customer.email,
      customerName: data.customer.name,
    },
  });

  logExternalCall('Flutterwave', 'webhook:wallet-credited', { userId, amountKobo, txnId }, null, true);

  // Send notification (non-blocking)
  notifyWalletFunded(userId, amountKobo).catch(console.error);
}

// ─── TRANSFER COMPLETED (payout/withdrawal status) ───────────────────────────

async function handleTransferCompleted(
  data: FlutterwaveWebhookPayload['data']
): Promise<void> {
  // Find the matching withdrawal transaction by providerReference
  const txnSnap = await adminDb
    .collection('transactions')
    .where('providerReference', '==', data.flw_ref)
    .where('category', '==', 'withdrawal')
    .limit(1)
    .get();

  if (txnSnap.empty) return;

  const txnDoc = txnSnap.docs[0];
  const newStatus = data.status === 'successful' ? 'success' : 'failed';

  await txnDoc.ref.update({
    status: newStatus,
    ...(newStatus === 'failed' ? { failureReason: 'Transfer failed by provider' } : {}),
    updatedAt: Timestamp.now(),
  });

  // If withdrawal failed, refund the wallet
  if (newStatus === 'failed') {
    const txn = txnDoc.data();
    await creditWallet(txn.userId, txn.amount, {
      category: 'refund',
      status: 'success',
      reference: generateReference('refund'),
      providerReference: data.flw_ref,
      provider: 'flutterwave',
      metadata: { originalTxnId: txnDoc.id, reason: 'Withdrawal transfer failed' },
    });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function resolveUserId(
  data: FlutterwaveWebhookPayload['data']
): Promise<string | null> {
  // 1. Try metadata.userId (set when initiating charge)
  if (data.meta?.userId) return data.meta.userId as string;

  // 2. Try tx_ref format "VA-{userId}-{timestamp}"
  const vaMatch = data.tx_ref.match(/^VA-([^-]+)-/);
  if (vaMatch?.[1]) return vaMatch[1];

  // 3. Fallback: look up user by email
  const userSnap = await adminDb
    .collection('users')
    .where('email', '==', data.customer.email)
    .limit(1)
    .get();

  return userSnap.empty ? null : userSnap.docs[0].id;
}

async function notifyWalletFunded(userId: string, amountKobo: number): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return;

  const user = userSnap.data() as { email: string; displayName: string };
  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');

  await sendMail({
    to: user.email,
    subject: `Wallet funded: ${koboToNaira(amountKobo)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Hi ${user.displayName},</h2>
        <p>Your VendPro wallet has been credited with <strong>${koboToNaira(amountKobo)}</strong>.</p>
        <p>Your new balance is available in your dashboard.</p>
      </div>
    `,
    text: `Your wallet has been credited with ${koboToNaira(amountKobo)}.`,
  });
}