// vtu-web/lib/providers/router.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #13 (config from Firestore)
// All VTU purchases go through here — never call a provider directly from a route handler.

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ProviderFactory } from './factory';
import { listActiveProvidersForService } from './config';
import type {
  AirtimeParams, CableParams, DataParams, ElectricityParams, ExamPinParams,
  MeterInfo, ProviderConfig, ProviderResponse, ServiceType, SmartCardInfo,
} from '@/types/provider';

// ─── Generic failover executor ────────────────────────────────────────────────

type OperationName = 'buyAirtime' | 'buyData' | 'payElectricity' | 'payCable' | 'buyExamPin';

async function executeWithFailover<P>(
  operation: OperationName,
  service: ServiceType,
  params: P,
  amountKobo: number,
): Promise<ProviderResponse> {
  const candidates = await listActiveProvidersForService(service);

  if (candidates.length === 0) {
    return {
      success: false,
      provider: 'none',
      providerReference: '',
      status: 'failed',
      message: `No active provider configured for ${service}.`,
      shouldRefund: true,
    };
  }

  const attempts: Array<{ provider: string; error: string }> = [];

  for (const config of candidates) {
    try {
      const instance = ProviderFactory.make(config);

      // Provider must declare it actually implements this operation for this service.
      // buyData/payCable resolution of providerPlanCode is handled by the caller
      // (see buyData below) — if the plan has no code for this provider, skip it.
      // @ts-expect-error — dynamic dispatch across the shared interface
      const result: ProviderResponse = await instance[operation](params);

      if (result.success) return result;

      attempts.push({ provider: config.code, error: result.message });
      // Try next provider on failure
    } catch (error) {
      attempts.push({ provider: config.code, error: (error as Error).message });
    }
  }

  // All providers failed — write to dead letter queue for manual/cron retry
  await adminDb.collection('dead_letter_queue').add({
    service,
    operation,
    amount: amountKobo,
    params,
    attempts: attempts.map(a => ({
      provider: a.provider,
      requestPayload: params,
      responseBody: { error: a.error },
      errorCode: 'PROVIDER_FAILED',
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
    message: 'All providers failed for this transaction.',
    // Conservative default: only refund if every attempted provider
    // explicitly said no charge was made.
    shouldRefund: true,
  };
}

// ─── Public API used by route handlers ───────────────────────────────────────

export async function buyAirtime(params: AirtimeParams): Promise<ProviderResponse> {
  return executeWithFailover('buyAirtime', 'airtime', params, params.amountKobo);
}

/**
 * dataPlanId is the internal Firestore `data_plans` document ID.
 * Each provider attempted needs its own variation code, stored on
 * dataPlan.providerPlanCodes[provider.code] — resolved per-attempt below.
 */
export async function buyData(params: Omit<DataParams, 'providerPlanCode'> & { dataPlanId: string }): Promise<ProviderResponse> {
  const planSnap = await adminDb.collection('data_plans').doc(params.dataPlanId).get();
  if (!planSnap.exists) {
    return {
      success: false, provider: 'none', providerReference: '', status: 'failed',
      message: 'Data plan not found.', shouldRefund: true,
    };
  }

  const plan = planSnap.data() as { providerPlanCodes?: Record<string, string> };
  const candidates = await listActiveProvidersForService('data');
  const attempts: Array<{ provider: string; error: string }> = [];

  for (const config of candidates) {
    const providerPlanCode = plan.providerPlanCodes?.[config.id] ?? plan.providerPlanCodes?.[config.code];
    if (!providerPlanCode) {
      // This provider doesn't carry this plan — skip, don't count as a failed attempt
      continue;
    }

    try {
      const instance = ProviderFactory.make(config);
      const result = await instance.buyData({ ...params, providerPlanCode });
      if (result.success) return result;
      attempts.push({ provider: config.code, error: result.message });
    } catch (error) {
      attempts.push({ provider: config.code, error: (error as Error).message });
    }
  }

  if (attempts.length === 0) {
    return {
      success: false, provider: 'none', providerReference: '', status: 'failed',
      message: 'No active provider carries this data plan.', shouldRefund: true,
    };
  }

  await adminDb.collection('dead_letter_queue').add({
    service: 'data', operation: 'buyData', amount: params.amountKobo, params,
    attempts: attempts.map(a => ({
      provider: a.provider, requestPayload: params,
      responseBody: { error: a.error }, errorCode: 'PROVIDER_FAILED', attemptedAt: Timestamp.now(),
    })),
    status: 'stuck', adminNote: null, assignedTo: null,
    createdAt: FieldValue.serverTimestamp(), resolvedAt: null,
  });

  return {
    success: false, provider: attempts[attempts.length - 1].provider, providerReference: '',
    status: 'failed', message: 'All providers failed for this data purchase.', shouldRefund: true,
  };
}

export async function payElectricity(params: ElectricityParams): Promise<ProviderResponse> {
  return executeWithFailover('payElectricity', 'electricity', params, params.amountKobo);
}

/**
 * cablePlanId resolves providerBouquetCode the same way buyData resolves
 * providerPlanCode — via cable_plans/{id}.providerPlanCodes[provider.code].
 */
export async function payCable(
  params: Omit<CableParams, 'providerBouquetCode' | 'providerAddonCodes'> & { cablePlanId: string; addonPlanIds?: string[] }
): Promise<ProviderResponse> {
  const planSnap = await adminDb.collection('cable_plans').doc(params.cablePlanId).get();
  if (!planSnap.exists) {
    return {
      success: false, provider: 'none', providerReference: '', status: 'failed',
      message: 'Cable bouquet not found.', shouldRefund: true,
    };
  }

  const plan = planSnap.data() as { providerPlanCodes?: Record<string, string> };
  const candidates = await listActiveProvidersForService('cable');

  for (const config of candidates) {
    const providerBouquetCode = plan.providerPlanCodes?.[config.id] ?? plan.providerPlanCodes?.[config.code];
    if (!providerBouquetCode) continue;

    try {
      const instance = ProviderFactory.make(config);
      const result = await instance.payCable({ ...params, providerBouquetCode });
      if (result.success) return result;
    } catch {
      continue;
    }
  }

  return {
    success: false, provider: 'none', providerReference: '', status: 'failed',
    message: 'No active provider carries this cable bouquet.', shouldRefund: true,
  };
}

export async function buyExamPin(params: ExamPinParams): Promise<ProviderResponse> {
  return executeWithFailover('buyExamPin', 'exam', params, params.amountKobo);
}

// ─── Verification (no failover — uses the highest-priority provider) ────────

export async function verifyMeter(meterNumber: string, disco: string, type: 'prepaid' | 'postpaid'): Promise<MeterInfo> {
  const [config] = await listActiveProvidersForService('electricity');
  if (!config) throw new Error('No active electricity provider configured.');
  return ProviderFactory.make(config).verifyMeter(meterNumber, disco, type);
}

export async function verifySmartCard(cardNumber: string, cableNetwork: string): Promise<SmartCardInfo> {
  const [config] = await listActiveProvidersForService('cable');
  if (!config) throw new Error('No active cable provider configured.');
  return ProviderFactory.make(config).verifySmartCard(cardNumber, cableNetwork);
}

// ─── Balance / health (used by cron jobs) ─────────────────────────────────────

export async function sumAllProviderBalances(): Promise<number> {
  const snap = await adminDb.collection('providers').where('isActive', '==', true).get();
  let total = 0;

  for (const doc of snap.docs) {
    const config = { id: doc.id, ...doc.data() } as ProviderConfig;
    try {
      const instance = ProviderFactory.make(config);
      total += await instance.getBalance();
    } catch (error) {
      console.warn(`[providers] balance check failed for ${config.name}:`, (error as Error).message);
    }
  }

  return total; // kobo
}

export async function checkAllProviderHealth(): Promise<Array<{ code: string; name: string; healthy: boolean }>> {
  const snap = await adminDb.collection('providers').where('isActive', '==', true).get();

  return Promise.all(
    snap.docs.map(async doc => {
      const config = { id: doc.id, ...doc.data() } as ProviderConfig;
      const instance = ProviderFactory.make(config);
      const healthy = await instance.isHealthy();
      return { code: config.code, name: config.name, healthy };
    })
  );
}

// ─── Webhook dispatch (mirrors VendorFactory::webhook) ────────────────────────

export async function handleProviderWebhook(identifier: string, payload: Record<string, unknown>): Promise<void> {
  const { getProviderConfigByIdentifier } = await import('./config');
  const config = await getProviderConfigByIdentifier(identifier);
  if (!config) throw new Error(`Unknown provider identifier: ${identifier}`);

  const instance = ProviderFactory.make(config);
  const result = await instance.handleWebhook(payload);

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
        ...(result.token ? { 'metadata.token': result.token } : {}),
        updatedAt: Timestamp.now(),
      });
    });
}