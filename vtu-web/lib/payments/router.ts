// vtu-web/lib/payments/router.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #13 (config from Firestore)
// All payment-gateway calls go through here — never call a gateway directly from a route handler.

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { PaymentGatewayFactory } from './factory';
import { getPrimaryGatewayForCapability, listActiveGatewaysForCapability } from './config';
import type {
  CreateVirtualAccountParams, InitiateFundingParams, PaymentGatewayConfig, PaymentResponse,
  PayoutParams, PayoutResult, ResolveAccountParams, ResolvedAccountInfo, VerifyFundingParams,
  VirtualAccountInfo,
} from '@/types/payment';

// ─── Funding (single gateway — no failover; the user is mid-checkout) ────────

export async function initiateFunding(params: InitiateFundingParams): Promise<PaymentResponse> {
  const config = await getPrimaryGatewayForCapability('fund');
  if (!config) {
    return {
      success: false, provider: 'none', providerReference: '', status: 'failed',
      message: 'No active payment gateway configured for wallet funding.',
    };
  }

  const gateway = PaymentGatewayFactory.make(config);
  return gateway.initiateFunding(params);
}

export async function verifyFunding(
  params: VerifyFundingParams,
  gatewayCode?: string
): Promise<PaymentResponse> {
  const config = gatewayCode
    ? await getPrimaryGatewayForCapability('fund').then(async primary =>
        primary?.code === gatewayCode ? primary : (await listActiveGatewaysForCapability('fund')).find(g => g.code === gatewayCode) ?? null
      )
    : await getPrimaryGatewayForCapability('fund');

  if (!config) {
    return {
      success: false, provider: gatewayCode ?? 'none', providerReference: '', status: 'failed',
      message: 'No matching payment gateway configured to verify this transaction.',
    };
  }

  const gateway = PaymentGatewayFactory.make(config);
  return gateway.verifyFunding(params);
}

// ─── Payout (failover across gateways — money leaving the platform) ──────────

export async function payout(params: PayoutParams): Promise<PayoutResult> {
  const candidates = await listActiveGatewaysForCapability('payout');

  if (candidates.length === 0) {
    return {
      success: false, provider: 'none', providerReference: '', status: 'failed',
      message: 'No active payment gateway configured for payouts.', fee: null,
    };
  }

  const attempts: Array<{ provider: string; error: string }> = [];

  for (const config of candidates) {
    try {
      const gateway = PaymentGatewayFactory.make(config);
      const result = await gateway.payout(params);
      if (result.success || result.status === 'pending') return result;
      attempts.push({ provider: config.code, error: result.message });
    } catch (error) {
      attempts.push({ provider: config.code, error: (error as Error).message });
    }
  }

  // All gateways failed — write to dead letter queue, same shape as VTU
  // failures, so the existing DLQ admin UI surfaces this too.
  await adminDb.collection('dead_letter_queue').add({
    service: 'payout',
    operation: 'payout',
    amount: params.amountKobo,
    params,
    attempts: attempts.map(a => ({
      provider: a.provider,
      requestPayload: params,
      responseBody: { error: a.error },
      errorCode: 'GATEWAY_FAILED',
      attemptedAt: Timestamp.now(),
    })),
    status: 'stuck',
    adminNote: null,
    assignedTo: null,
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: null,
  });

  return {
    success: false,
    provider: attempts[attempts.length - 1]?.provider ?? 'unknown',
    providerReference: '',
    status: 'failed',
    message: 'All payment gateways failed for this payout.',
    fee: null,
  };
}

// ─── Virtual accounts (single gateway — no failover, account must persist) ───

export async function createVirtualAccount(params: CreateVirtualAccountParams): Promise<VirtualAccountInfo> {
  const config = await getPrimaryGatewayForCapability('virtual_account');
  if (!config) throw new Error('No active payment gateway configured for virtual accounts.');
  return PaymentGatewayFactory.make(config).createVirtualAccount(params);
}

export async function resolveAccount(params: ResolveAccountParams): Promise<ResolvedAccountInfo> {
  // Resolution typically rides on whichever gateway also does payouts.
  const config = await getPrimaryGatewayForCapability('payout')
    ?? await getPrimaryGatewayForCapability('virtual_account');
  if (!config) throw new Error('No active payment gateway configured for account resolution.');
  return PaymentGatewayFactory.make(config).resolveAccount(params);
}

// ─── Balance / health (used by cron jobs) ─────────────────────────────────────

export async function sumAllGatewayBalances(): Promise<number> {
  const snap = await adminDb.collection('payment_gateways').where('isActive', '==', true).get();
  let total = 0;

  for (const doc of snap.docs) {
    const config = { id: doc.id, ...doc.data() } as PaymentGatewayConfig;
    try {
      const instance = PaymentGatewayFactory.make(config);
      total += await instance.getBalance();
    } catch (error) {
      console.warn(`[payments] balance check failed for ${config.name}:`, (error as Error).message);
    }
  }

  return total; // kobo
}

export async function checkAllGatewayHealth(): Promise<Array<{ code: string; name: string; healthy: boolean }>> {
  const snap = await adminDb.collection('payment_gateways').where('isActive', '==', true).get();

  return Promise.all(
    snap.docs.map(async doc => {
      const config = { id: doc.id, ...doc.data() } as PaymentGatewayConfig;
      const instance = PaymentGatewayFactory.make(config);
      const healthy = await instance.isHealthy();
      return { code: config.code, name: config.name, healthy };
    })
  );
}

// ─── Webhook dispatch (mirrors handleProviderWebhook in lib/providers/router.ts) ──

/**
 * Routes an inbound webhook to the right gateway by its `identifier`
 * (e.g. /api/webhooks/[identifier]/route.ts passes the URL segment here),
 * verifies the signature BEFORE processing (AGENTS.md security checklist),
 * then updates the matching transaction.
 */
export async function handlePaymentWebhook(
  identifier: string,
  headers: Record<string, string | undefined>,
  rawBody: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { getPaymentGatewayConfigByIdentifier } = await import('./config');
  const config = await getPaymentGatewayConfigByIdentifier(identifier);
  if (!config) throw new Error(`Unknown payment gateway identifier: ${identifier}`);

  const instance = PaymentGatewayFactory.make(config);

  if (!instance.verifyWebhookSignature(headers, rawBody)) {
    throw new Error(`${config.name}: webhook signature verification failed`);
  }

  const result = await instance.handleWebhook(payload);
  if (!result.reference) return;

  // Deduplicate: only process each provider event once (AGENTS.md security
  // checklist — processed webhook IDs stored to prevent double-credit).
  const dedupeId = `${config.code}:${result.reference}:${result.status}`;
  const dedupeRef = adminDb.collection('processed_webhooks').doc(dedupeId);
  const dedupeSnap = await dedupeRef.get();
  if (dedupeSnap.exists) return;
  await dedupeRef.set({ identifier, reference: result.reference, createdAt: FieldValue.serverTimestamp() });

  await adminDb
    .collection('transactions')
    .where('reference', '==', result.reference)
    .limit(1)
    .get()
    .then(snap => {
      if (snap.empty) return;
      return snap.docs[0].ref.update({
        status: result.status,
        ...(result.providerReference ? { providerReference: result.providerReference } : {}),
        updatedAt: Timestamp.now(),
      });
    });
}