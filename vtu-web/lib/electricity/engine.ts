// vtu-web/lib/electricity/engine.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #8 (never hard-delete), #9 (log), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Supported Nigerian electricity distribution companies (DISCOs).
 * Codes are the internal identifiers used across the platform and sent
 * to the provider router (which maps them to provider-specific codes).
 */
export const DISCOS = [
  'phcn', 'aedc', 'ikedc', 'ekedc', 'eedc', 'kedco',
  'ibedc', 'jedc', 'kaedco', 'phed', 'yedc',
] as const;

export type Disco = typeof DISCOS[number];

export const DISCO_LABELS: Record<Disco, string> = {
  phcn: 'PHCN',
  aedc: 'Abuja Electricity (AEDC)',
  ikedc: 'Ikeja Electric (IKEDC)',
  ekedc: 'Eko Electricity (EKEDC)',
  eedc: 'Enugu Electricity (EEDC)',
  kedco: 'Kano Electricity (KEDCO)',
  ibedc: 'Ibadan Electricity (IBEDC)',
  jedc: 'Jos Electricity (JEDC)',
  kaedco: 'Kaduna Electricity (KAEDCO)',
  phed: 'Port Harcourt Electricity (PHED)',
  yedc: 'Yola Electricity (YEDC)',
};

export type MeterType = 'prepaid' | 'postpaid';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeterVerificationResult {
  customerName: string;
  meterNumber: string;
  disco: Disco;
  type: MeterType;
  address: string | null;
  outstandingBalanceKobo: number | null; // postpaid only
}

export interface ElectricityPurchaseResult {
  success: boolean;
  provider: string;
  providerReference: string;
  token: string | null;          // prepaid token (e.g. "1234-5678-9012-3456")
  units: string | null;          // estimated kWh units (string from provider)
  error?: string;
  shouldRefund?: boolean;
}

export type BillSplitStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'paid' | 'cancelled';

export interface BillSplitRequest {
  id: string;
  initiatorId: string;
  partnerId: string;
  disco: Disco;
  meterNumber: string;
  meterType: MeterType;
  customerName: string;
  totalAmountKobo: number;
  initiatorShareKobo: number;
  partnerShareKobo: number;
  status: BillSplitStatus;
  // Set once both sides have paid / the purchase has executed
  transactionId: string | null;
  initiatorPaid: boolean;
  partnerPaid: boolean;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Phone / meter normalisation ──────────────────────────────────────────────

/**
 * Normalise a meter number: strip whitespace/dashes, keep digits only.
 */
export function normaliseMeterNumber(meterNumber: string): string {
  return meterNumber.replace(/[\s-]/g, '');
}

// ─── Meter verification ───────────────────────────────────────────────────────

/**
 * Verify a meter number with the provider router before allowing payment.
 * Caches verification results for 10 minutes per (disco, meterNumber, type)
 * to avoid hammering the provider when a user re-checks the same meter.
 */
const _verifyCache = new Map<string, { result: MeterVerificationResult; expiresAt: number }>();
const VERIFY_CACHE_TTL_MS = 10 * 60 * 1000;

export async function verifyMeter(
  meterNumber: string,
  disco: Disco,
  type: MeterType
): Promise<MeterVerificationResult> {
  const normalised = normaliseMeterNumber(meterNumber);
  const cacheKey = `${disco}:${type}:${normalised}`;

  const cached = _verifyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const { verifyMeter: providerVerifyMeter } = await import('@/lib/providers/router');

  const info = await providerVerifyMeter(normalised, disco, type);

  const result: MeterVerificationResult = {
    customerName: info.customerName,
    meterNumber: normalised,
    disco,
    type,
    address: info.address ?? null,
    outstandingBalanceKobo:
      type === 'postpaid' && typeof (info as any).outstandingBalanceKobo === 'number'
        ? (info as any).outstandingBalanceKobo
        : null,
  };

  _verifyCache.set(cacheKey, { result, expiresAt: Date.now() + VERIFY_CACHE_TTL_MS });
  return result;
}

export function invalidateMeterCache(meterNumber: string, disco: Disco, type: MeterType): void {
  _verifyCache.delete(`${disco}:${type}:${normaliseMeterNumber(meterNumber)}`);
}

// ─── Purchase (provider call wrapper) ─────────────────────────────────────────

export interface ElectricityPurchaseParams {
  meterNumber: string;
  disco: Disco;
  type: MeterType;
  amount: number;       // kobo
  customerName: string;
  reference: string;
}

/**
 * Call the provider router to pay an electricity bill.
 * Wraps payElectricity() and normalises the response shape, including
 * extracting the prepaid token / units from provider-specific payloads.
 */
export async function purchaseElectricity(
  params: ElectricityPurchaseParams
): Promise<ElectricityPurchaseResult> {
  const { payElectricity } = await import('@/lib/providers/router');

  const result = await payElectricity({
    meterNumber: params.meterNumber,
    disco: params.disco,
    type: params.type,
    amount: params.amount,
    customerName: params.customerName,
    reference: params.reference,
  });

  const data = (result.data ?? {}) as Record<string, unknown>;

  return {
    success: result.success,
    provider: (result as any).provider ?? 'unknown',
    providerReference: result.providerReference ?? '',
    token: typeof data.token === 'string' ? data.token : null,
    units: typeof data.units === 'string' ? data.units : (typeof data.units === 'number' ? String(data.units) : null),
    error: result.error,
    shouldRefund: result.shouldRefund,
  };
}

// ─── Token delivery (SMS + email) ─────────────────────────────────────────────

/**
 * Deliver a prepaid electricity token to the user via email and (if configured) SMS.
 * Non-blocking — caller should fire this without awaiting in the request path,
 * but it's safe to await for small operations.
 */
export async function deliverElectricityToken(opts: {
  userId: string;
  token: string | null;
  units: string | null;
  disco: Disco;
  meterNumber: string;
  customerName: string;
  amountKobo: number;
  reference: string;
}): Promise<void> {
  const userSnap = await adminDb.collection('users').doc(opts.userId).get();
  if (!userSnap.exists) return;

  const user = userSnap.data() as {
    email: string;
    displayName: string;
    phone: string;
    notifications: { email: boolean; sms: boolean };
  };

  const { koboToNaira } = await import('@/lib/utils/formatter');
  const discoLabel = DISCO_LABELS[opts.disco];
  const amountStr = koboToNaira(opts.amountKobo);

  // Email
  if (user.notifications?.email) {
    const { sendMail } = await import('@/lib/mail/client');
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';

    await sendMail({
      to: user.email,
      subject: opts.token
        ? `Your ${discoLabel} electricity token is ready ⚡`
        : `Electricity payment successful — ${discoLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Electricity payment successful ⚡</h2>
          <p>Hi ${user.displayName},</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Disco</td><td style="padding:8px;font-weight:600">${discoLabel}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Meter number</td><td style="padding:8px">${opts.meterNumber}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Customer</td><td style="padding:8px">${opts.customerName}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600">${amountStr}</td></tr>
            ${opts.token ? `
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Token</td><td style="padding:8px;font-weight:700;font-size:18px;letter-spacing:2px">${opts.token}</td></tr>
            ` : ''}
            ${opts.units ? `
            <tr><td style="padding:8px;color:#6b7280">Estimated units</td><td style="padding:8px">${opts.units} kWh</td></tr>
            ` : ''}
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Reference</td><td style="padding:8px;font-size:12px">${opts.reference}</td></tr>
          </table>
          ${opts.token ? `<p style="color:#6b7280;font-size:13px">Enter this token on your meter keypad to load your units. Keep this token for your records.</p>` : ''}
        </div>
      `,
      text: opts.token
        ? `${discoLabel} token for meter ${opts.meterNumber}: ${opts.token}${opts.units ? ` (~${opts.units} kWh)` : ''}. Amount: ${amountStr}. Ref: ${opts.reference}`
        : `${discoLabel} electricity payment of ${amountStr} for meter ${opts.meterNumber} was successful. Ref: ${opts.reference}`,
    });
  }

  // SMS (critical event per AGENTS.md notification rules)
  if (user.notifications?.sms && user.phone) {
    try {
      const { sendSms } = await import('@/lib/sms/client');
      const smsText = opts.token
        ? `${discoLabel} token: ${opts.token}${opts.units ? ` (~${opts.units}kWh)` : ''}. Amt: ${amountStr}. Ref: ${opts.reference}`
        : `${discoLabel} payment of ${amountStr} successful for meter ${opts.meterNumber}. Ref: ${opts.reference}`;

      if (typeof sendSms === 'function') {
        await sendSms(user.phone, smsText);
      }
    } catch (error) {
      console.error('[electricity:sms-delivery]', opts.reference, error);
    }
  }
}

// ─── Bill split ────────────────────────────────────────────────────────────────

const SPLIT_EXPIRY_HOURS = 24;

/**
 * Create a bill-split request: the initiator pays their share immediately
 * (held as a pending split, not yet debited), and the partner is invited
 * to pay their share. The actual electricity purchase only fires once
 * both shares have been paid.
 */
export async function createBillSplit(
  initiatorId: string,
  input: {
    partnerIdentifier: string; // email, phone, or referral code
    disco: Disco;
    meterNumber: string;
    meterType: MeterType;
    customerName: string;
    totalAmountKobo: number;
    initiatorShareKobo: number;
  }
): Promise<{ splitId: string; partnerShareKobo: number }> {
  if (input.initiatorShareKobo <= 0 || input.initiatorShareKobo >= input.totalAmountKobo) {
    throw new Error('Initiator share must be greater than 0 and less than the total amount');
  }

  const partner = await resolveUserByIdentifier(input.partnerIdentifier);
  if (!partner) throw new Error('Could not find the partner you specified');
  if (partner.id === initiatorId) throw new Error('You cannot split a bill with yourself');

  const partnerShareKobo = input.totalAmountKobo - input.initiatorShareKobo;
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + SPLIT_EXPIRY_HOURS * 60 * 60 * 1000));

  const ref = adminDb.collection('electricity_bill_splits').doc();
  await ref.set({
    id: ref.id,
    initiatorId,
    partnerId: partner.id,
    disco: input.disco,
    meterNumber: normaliseMeterNumber(input.meterNumber),
    meterType: input.meterType,
    customerName: input.customerName,
    totalAmountKobo: input.totalAmountKobo,
    initiatorShareKobo: input.initiatorShareKobo,
    partnerShareKobo,
    status: 'pending',
    transactionId: null,
    initiatorPaid: false,
    partnerPaid: false,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  } satisfies Omit<BillSplitRequest, 'id' | 'createdAt' | 'updatedAt'> & {
    id: string;
    createdAt: unknown;
    updatedAt: unknown;
  });

  notifyBillSplitInvite(partner.id, initiatorId, ref.id, partnerShareKobo, input).catch(console.error);

  return { splitId: ref.id, partnerShareKobo };
}

export async function getBillSplit(splitId: string): Promise<BillSplitRequest | null> {
  const snap = await adminDb.collection('electricity_bill_splits').doc(splitId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as BillSplitRequest;
}

export async function listBillSplits(userId: string): Promise<BillSplitRequest[]> {
  const [initiated, received] = await Promise.all([
    adminDb.collection('electricity_bill_splits')
      .where('initiatorId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
    adminDb.collection('electricity_bill_splits')
      .where('partnerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
  ]);

  const all = [...initiated.docs, ...received.docs].map(d => ({ id: d.id, ...d.data() }) as BillSplitRequest);

  // De-dupe (shouldn't overlap, but guard anyway) and sort by createdAt desc
  const seen = new Set<string>();
  return all
    .filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

/**
 * The partner accepts and pays their share. If the initiator has also paid
 * (or pays in the same step — see API route), the electricity purchase fires.
 *
 * Returns the updated split. The caller's API route is responsible for
 * orchestrating the actual wallet debit BEFORE calling this — this function
 * only updates split bookkeeping and triggers the purchase once both sides
 * have paid.
 */
export async function markSplitSharePaid(
  splitId: string,
  payerId: string
): Promise<BillSplitRequest> {
  const ref = adminDb.collection('electricity_bill_splits').doc(splitId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Bill split not found');

  const split = snap.data() as BillSplitRequest;

  if (split.status !== 'pending' && split.status !== 'accepted') {
    throw new Error(`This bill split is already ${split.status}`);
  }
  if (Date.now() > split.expiresAt.toMillis()) {
    await ref.update({ status: 'expired', updatedAt: Timestamp.now() });
    throw new Error('This bill split request has expired');
  }
  if (payerId !== split.initiatorId && payerId !== split.partnerId) {
    throw new Error('You are not part of this bill split');
  }

  const isInitiator = payerId === split.initiatorId;
  const update: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    status: 'accepted',
  };

  if (isInitiator) update.initiatorPaid = true;
  else update.partnerPaid = true;

  const bothPaid =
    (isInitiator ? true : split.initiatorPaid) &&
    (isInitiator ? split.partnerPaid : true);

  await ref.update(update);

  const updated = { ...split, ...update } as BillSplitRequest;

  if (bothPaid) {
    await executeSplitPurchase(splitId);
    return (await getBillSplit(splitId))!;
  }

  return updated;
}

export async function declineBillSplit(splitId: string, userId: string): Promise<void> {
  const ref = adminDb.collection('electricity_bill_splits').doc(splitId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Bill split not found');

  const split = snap.data() as BillSplitRequest;
  if (split.partnerId !== userId && split.initiatorId !== userId) {
    throw new Error('You are not part of this bill split');
  }
  if (split.status !== 'pending' && split.status !== 'accepted') {
    throw new Error(`This bill split is already ${split.status}`);
  }

  await ref.update({ status: 'declined', updatedAt: Timestamp.now() });

  // Refund whichever side already paid
  if (split.initiatorPaid || split.partnerPaid) {
    const { creditWallet } = await import('@/lib/wallet/operations');
    const { generateReference } = await import('@/lib/utils/reference');

    if (split.initiatorPaid) {
      await creditWallet(split.initiatorId, split.initiatorShareKobo, {
        category: 'refund',
        status: 'success',
        reference: generateReference('refund'),
        metadata: { reason: 'Bill split declined', splitId },
      });
    }
    if (split.partnerPaid) {
      await creditWallet(split.partnerId, split.partnerShareKobo, {
        category: 'refund',
        status: 'success',
        reference: generateReference('refund'),
        metadata: { reason: 'Bill split declined', splitId },
      });
    }
  }
}

/**
 * Once both shares are paid, execute the electricity purchase using the
 * combined total. Updates the split with the resulting transaction ID.
 * If the purchase fails, both parties are refunded their share.
 */
async function executeSplitPurchase(splitId: string): Promise<void> {
  const ref = adminDb.collection('electricity_bill_splits').doc(splitId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const split = snap.data() as BillSplitRequest;

  if (split.transactionId) return; // already executed — idempotent

  const { generateReference } = await import('@/lib/utils/reference');
  const reference = generateReference('electricity');

  const result = await purchaseElectricity({
    meterNumber: split.meterNumber,
    disco: split.disco,
    type: split.meterType,
    amount: split.totalAmountKobo,
    customerName: split.customerName,
    reference,
  });

  if (result.success) {
    await ref.update({
      status: 'paid',
      transactionId: reference,
      updatedAt: Timestamp.now(),
    });

    // Deliver token/units to both parties
    await Promise.all([
      deliverElectricityToken({
        userId: split.initiatorId,
        token: result.token,
        units: result.units,
        disco: split.disco,
        meterNumber: split.meterNumber,
        customerName: split.customerName,
        amountKobo: split.initiatorShareKobo,
        reference,
      }).catch(console.error),
      deliverElectricityToken({
        userId: split.partnerId,
        token: result.token,
        units: result.units,
        disco: split.disco,
        meterNumber: split.meterNumber,
        customerName: split.customerName,
        amountKobo: split.partnerShareKobo,
        reference,
      }).catch(console.error),
    ]);
  } else {
    // Provider failed — refund both sides
    const { creditWallet } = await import('@/lib/wallet/operations');

    await Promise.all([
      creditWallet(split.initiatorId, split.initiatorShareKobo, {
        category: 'refund',
        status: 'success',
        reference: generateReference('refund'),
        metadata: { reason: 'Bill split purchase failed', splitId, providerError: result.error },
      }),
      creditWallet(split.partnerId, split.partnerShareKobo, {
        category: 'refund',
        status: 'success',
        reference: generateReference('refund'),
        metadata: { reason: 'Bill split purchase failed', splitId, providerError: result.error },
      }),
    ]);

    await ref.update({
      status: 'cancelled',
      updatedAt: Timestamp.now(),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveUserByIdentifier(identifier: string) {
  const byEmail = await adminDb
    .collection('users')
    .where('email', '==', identifier.toLowerCase())
    .limit(1)
    .get();
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() } as any;

  const byPhone = await adminDb
    .collection('users')
    .where('phone', '==', identifier)
    .limit(1)
    .get();
  if (!byPhone.empty) return { id: byPhone.docs[0].id, ...byPhone.docs[0].data() } as any;

  const byReferral = await adminDb
    .collection('users')
    .where('referralCode', '==', identifier.toUpperCase())
    .limit(1)
    .get();
  if (!byReferral.empty) return { id: byReferral.docs[0].id, ...byReferral.docs[0].data() } as any;

  return null;
}

async function notifyBillSplitInvite(
  partnerId: string,
  initiatorId: string,
  splitId: string,
  partnerShareKobo: number,
  input: { disco: Disco; meterNumber: string; meterType: MeterType; customerName: string }
): Promise<void> {
  const [partnerSnap, initiatorSnap] = await Promise.all([
    adminDb.collection('users').doc(partnerId).get(),
    adminDb.collection('users').doc(initiatorId).get(),
  ]);
  if (!partnerSnap.exists || !initiatorSnap.exists) return;

  const partner = partnerSnap.data() as { email: string; displayName: string; notifications: { email: boolean } };
  const initiator = initiatorSnap.data() as { displayName: string };

  if (!partner.notifications?.email) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const discoLabel = DISCO_LABELS[input.disco];

  await sendMail({
    to: partner.email,
    subject: `${initiator.displayName} wants to split an electricity bill with you`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bill split request ⚡</h2>
        <p>Hi ${partner.displayName},</p>
        <p><strong>${initiator.displayName}</strong> wants to split a ${discoLabel} electricity bill with you.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Meter</td><td style="padding:8px">${input.meterNumber} (${input.customerName})</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Your share</td><td style="padding:8px;font-weight:600">${koboToNaira(partnerShareKobo)}</td></tr>
        </table>
        <a href="${appUrl}/dashboard/electricity?split=${splitId}"
           style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px">
          View &amp; pay your share
        </a>
        <p style="color:#6b7280;font-size:13px">This request expires in 24 hours. Powered by ${appName}.</p>
      </div>
    `,
    text: `${initiator.displayName} wants to split a ${discoLabel} bill with you. Your share: ${koboToNaira(partnerShareKobo)}. View at ${appUrl}/dashboard/electricity?split=${splitId}`,
  });
}