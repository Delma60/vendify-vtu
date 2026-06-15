// vtu-web/lib/providers/float.ts
// AGENTS.md RULES: #1 (kobo), #9 (log every external call), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ProviderFactory } from './factory';
import type { ProviderConfig } from '@/types/provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderFloatRecord {
  providerId: string;
  providerName: string;
  providerCode: string;
  balanceKobo: number;
  lowThresholdKobo: number;
  autoFundEnabled: boolean;
  autoFundAmountKobo: number;
  lastCheckedAt: Timestamp | null;
  lastFundedAt: Timestamp | null;
  updatedAt: Timestamp;
  isLow: boolean;
  isActive: boolean;
}

export interface FloatHistoryEntry {
  id: string;
  providerId: string;
  providerName: string;
  type: 'check' | 'auto_fund' | 'manual_fund' | 'alert';
  previousBalanceKobo: number;
  newBalanceKobo: number | null;
  amountKobo: number | null;
  note: string;
  triggeredBy: 'system' | 'admin';
  adminId: string | null;
  createdAt: Timestamp;
}

export interface FloatCheckSummary {
  checked: number;
  low: number;
  autoFunded: number;
  alerted: number;
  errors: string[];
  runAt: string;
}

export interface FloatUpdateInput {
  lowThresholdKobo?: number;
  autoFundEnabled?: boolean;
  autoFundAmountKobo?: number;
}

// ─── List all provider float records ─────────────────────────────────────────

export async function listProviderFloats(): Promise<ProviderFloatRecord[]> {
  // Fetch providers + floats in parallel
  const [providersSnap, floatsSnap] = await Promise.all([
    adminDb.collection('providers').orderBy('name', 'asc').get(),
    adminDb.collection('provider_floats').get(),
  ]);

  const floatMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of floatsSnap.docs) {
    floatMap.set(doc.id, doc.data());
  }

  return providersSnap.docs.map((doc) => {
    const provider = { id: doc.id, ...doc.data() } as ProviderConfig;
    const float = floatMap.get(doc.id) ?? {
      balance: 0,
      lowThreshold: 5_000_000, // ₦50,000 default
      autoFundEnabled: false,
      autoFundAmount: 0,
      lastCheckedAt: null,
      lastFundedAt: null,
      updatedAt: Timestamp.now(),
    };

    const balanceKobo = (float.balance as number) ?? 0;
    const lowThresholdKobo = (float.lowThreshold as number) ?? 5_000_000;

    return {
      providerId: doc.id,
      providerName: provider.name,
      providerCode: provider.code,
      balanceKobo,
      lowThresholdKobo,
      autoFundEnabled: (float.autoFundEnabled as boolean) ?? false,
      autoFundAmountKobo: (float.autoFundAmount as number) ?? 0,
      lastCheckedAt: (float.lastCheckedAt as Timestamp | null) ?? null,
      lastFundedAt: (float.lastFundedAt as Timestamp | null) ?? null,
      updatedAt: (float.updatedAt as Timestamp) ?? Timestamp.now(),
      isLow: balanceKobo < lowThresholdKobo,
      isActive: provider.isActive,
    };
  });
}

// ─── Get float history for a provider ────────────────────────────────────────

export async function getFloatHistory(
  providerId: string,
  limit = 20
): Promise<FloatHistoryEntry[]> {
  const snap = await adminDb
    .collection('provider_float_history')
    .where('providerId', '==', providerId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FloatHistoryEntry);
}

// ─── Update float settings for a provider ────────────────────────────────────

export async function updateFloatSettings(
  providerId: string,
  updates: FloatUpdateInput,
  adminId: string
): Promise<void> {
  const floatRef = adminDb.collection('provider_floats').doc(providerId);
  const snap = await floatRef.get();

  const payload: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.lowThresholdKobo !== undefined) {
    payload.lowThreshold = updates.lowThresholdKobo;
  }
  if (updates.autoFundEnabled !== undefined) {
    payload.autoFundEnabled = updates.autoFundEnabled;
  }
  if (updates.autoFundAmountKobo !== undefined) {
    payload.autoFundAmount = updates.autoFundAmountKobo;
  }

  if (snap.exists) {
    await floatRef.update(payload);
  } else {
    await floatRef.set({
      providerId,
      balance: 0,
      lowThreshold: updates.lowThresholdKobo ?? 5_000_000,
      autoFundEnabled: updates.autoFundEnabled ?? false,
      autoFundAmount: updates.autoFundAmountKobo ?? 0,
      lastCheckedAt: null,
      lastFundedAt: null,
      updatedAt: Timestamp.now(),
    });
  }

  // Audit via history log
  await writeFloatHistory({
    providerId,
    type: 'check',
    previousBalanceKobo: (snap.data()?.balance as number) ?? 0,
    newBalanceKobo: null,
    amountKobo: null,
    note: `Settings updated by admin`,
    triggeredBy: 'admin',
    adminId,
  });
}

// ─── Manually sync balance from provider API ─────────────────────────────────

export async function syncProviderBalance(
  providerId: string,
  adminId?: string
): Promise<{ balanceKobo: number; success: boolean; error?: string }> {
  const providerSnap = await adminDb.collection('providers').doc(providerId).get();
  if (!providerSnap.exists) throw new Error('Provider not found');

  const config = { id: providerSnap.id, ...providerSnap.data() } as ProviderConfig;

  const floatRef = adminDb.collection('provider_floats').doc(providerId);
  const floatSnap = await floatRef.get();
  const previousBalance = (floatSnap.data()?.balance as number) ?? 0;

  let balanceKobo = 0;
  let success = false;
  let error: string | undefined;

  try {
    const instance = ProviderFactory.make(config);
    balanceKobo = await instance.getBalance();
    success = true;

    // Persist updated balance
    if (floatSnap.exists) {
      await floatRef.update({
        balance: balanceKobo,
        lastCheckedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } else {
      await floatRef.set({
        providerId,
        balance: balanceKobo,
        lowThreshold: 5_000_000,
        autoFundEnabled: false,
        autoFundAmount: 0,
        lastCheckedAt: Timestamp.now(),
        lastFundedAt: null,
        updatedAt: Timestamp.now(),
      });
    }

    await writeFloatHistory({
      providerId,
      type: 'check',
      previousBalanceKobo: previousBalance,
      newBalanceKobo: balanceKobo,
      amountKobo: null,
      note: 'Balance synced from provider API',
      triggeredBy: adminId ? 'admin' : 'system',
      adminId: adminId ?? null,
    });
  } catch (e) {
    error = (e as Error).message;
    console.error(`[float:sync] provider=${config.name}`, error);
  }

  return { balanceKobo, success, error };
}

// ─── Manual fund (record admin top-up) ───────────────────────────────────────

/**
 * Records that an admin has manually topped up a provider float.
 * The actual transfer is done outside the platform (e.g., bank transfer to provider).
 * This call just records the event and updates the cached balance.
 */
export async function recordManualFund(
  providerId: string,
  amountKobo: number,
  note: string,
  adminId: string
): Promise<void> {
  const floatRef = adminDb.collection('provider_floats').doc(providerId);
  const snap = await floatRef.get();

  const previousBalance = (snap.data()?.balance as number) ?? 0;
  const newBalance = previousBalance + amountKobo;

  if (snap.exists) {
    await floatRef.update({
      balance: newBalance,
      lastFundedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else {
    await floatRef.set({
      providerId,
      balance: newBalance,
      lowThreshold: 5_000_000,
      autoFundEnabled: false,
      autoFundAmount: 0,
      lastCheckedAt: Timestamp.now(),
      lastFundedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await writeFloatHistory({
    providerId,
    type: 'manual_fund',
    previousBalanceKobo: previousBalance,
    newBalanceKobo: newBalance,
    amountKobo,
    note: note || 'Manual top-up by admin',
    triggeredBy: 'admin',
    adminId,
  });
}

// ─── Cron: check all provider float levels ───────────────────────────────────

/**
 * Called by /api/cron/provider-float-check every 30 minutes.
 * Checks each active provider's live balance, updates Firestore, and
 * triggers alerts / auto-fund when below threshold.
 */
export async function checkProviderFloatLevels(): Promise<FloatCheckSummary> {
  const providersSnap = await adminDb
    .collection('providers')
    .where('isActive', '==', true)
    .get();

  const summary: FloatCheckSummary = {
    checked: 0,
    low: 0,
    autoFunded: 0,
    alerted: 0,
    errors: [],
    runAt: new Date().toISOString(),
  };

  for (const doc of providersSnap.docs) {
    const config = { id: doc.id, ...doc.data() } as ProviderConfig;

    try {
      const instance = ProviderFactory.make(config);
      const balanceKobo = await instance.getBalance();
      summary.checked++;

      const floatRef = adminDb.collection('provider_floats').doc(doc.id);
      const floatSnap = await floatRef.get();
      const floatData = floatSnap.data() ?? {
        lowThreshold: 5_000_000,
        autoFundEnabled: false,
        autoFundAmount: 0,
      };

      const lowThreshold = (floatData.lowThreshold as number) ?? 5_000_000;
      const previousBalance = (floatData.balance as number) ?? 0;
      const autoFundEnabled = (floatData.autoFundEnabled as boolean) ?? false;
      const autoFundAmount = (floatData.autoFundAmount as number) ?? 0;
      const isLow = balanceKobo < lowThreshold;

      // Update balance in Firestore
      await floatRef.set(
        {
          balance: balanceKobo,
          lastCheckedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await writeFloatHistory({
        providerId: doc.id,
        type: 'check',
        previousBalanceKobo: previousBalance,
        newBalanceKobo: balanceKobo,
        amountKobo: null,
        note: `Scheduled balance check: ₦${(balanceKobo / 100).toLocaleString()}`,
        triggeredBy: 'system',
        adminId: null,
      });

      if (isLow) {
        summary.low++;

        // Alert admin
        await sendLowFloatAlert(config.name, balanceKobo, lowThreshold);
        summary.alerted++;

        // Auto-fund if enabled
        if (autoFundEnabled && autoFundAmount > 0) {
          await triggerAutoFund(doc.id, config, autoFundAmount, lowThreshold);
          summary.autoFunded++;
          await floatRef.update({
            lastFundedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      }
    } catch (e) {
      const msg = `${config.name}: ${(e as Error).message}`;
      summary.errors.push(msg);
      console.error(`[float:check]`, msg);
    }
  }

  return summary;
}

// ─── Auto-fund trigger (placeholder — actual implementation depends on provider) ──

async function triggerAutoFund(
  providerId: string,
  config: ProviderConfig,
  amountKobo: number,
  thresholdKobo: number
): Promise<void> {
  const floatRef = adminDb.collection('provider_floats').doc(providerId);
  const snap = await floatRef.get();
  const previousBalance = (snap.data()?.balance as number) ?? 0;

  // Record the auto-fund event
  await writeFloatHistory({
    providerId,
    type: 'auto_fund',
    previousBalanceKobo: previousBalance,
    newBalanceKobo: previousBalance + amountKobo,
    amountKobo,
    note: `Auto-fund triggered: balance dropped below threshold of ₦${(thresholdKobo / 100).toLocaleString('en-NG')}`,
    triggeredBy: 'system',
    adminId: null,
  });

  // TODO: Implement actual transfer to provider via Flutterwave payout
  // This would call: initiatePayout(amountKobo / 100, 'NGN', bankCode, accountNumber, ...)
  // For now, log the intent and alert admins
  console.log(`[float:auto-fund] ${config.name}: ₦${(amountKobo / 100).toLocaleString()}`);
}

// ─── Alert helpers ─────────────────────────────────────────────────────────────

async function sendLowFloatAlert(
  providerName: string,
  balanceKobo: number,
  thresholdKobo: number
): Promise<void> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (!adminEmails.length) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  for (const email of adminEmails) {
    await sendMail({
      to: email,
      subject: `⚠️ Low provider float: ${providerName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2>⚠️ Provider float below threshold</h2>
          <p><strong>${providerName}</strong> float balance has dropped below the configured threshold.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr style="background:#fef3c7">
              <td style="padding:8px;color:#92400e">Current Balance</td>
              <td style="padding:8px;font-weight:700;color:#92400e">${koboToNaira(balanceKobo)}</td>
            </tr>
            <tr>
              <td style="padding:8px;color:#6b7280">Alert Threshold</td>
              <td style="padding:8px">${koboToNaira(thresholdKobo)}</td>
            </tr>
          </table>
          <p>Please fund this provider's account to avoid service interruption.</p>
          <a href="${appUrl}/admin/providers/floats"
             style="display:inline-block;padding:12px 24px;background:#F97316;color:#fff;
                    text-decoration:none;border-radius:8px;margin:16px 0;font-weight:600">
            Manage Provider Floats
          </a>
        </div>
      `,
      text: `${providerName} float is low: ${koboToNaira(balanceKobo)} (threshold: ${koboToNaira(thresholdKobo)}). Visit ${appUrl}/admin/providers/floats`,
    }).catch(console.error);
  }
}

// ─── Write float history ───────────────────────────────────────────────────────

async function writeFloatHistory(entry: Omit<FloatHistoryEntry, 'id' | 'providerName' | 'createdAt'>): Promise<void> {
  // Resolve provider name
  const providerSnap = await adminDb.collection('providers').doc(entry.providerId).get();
  const providerName = providerSnap.exists ? (providerSnap.data()?.name as string) : 'Unknown';

  await adminDb.collection('provider_float_history').add({
    ...entry,
    providerName,
    createdAt: FieldValue.serverTimestamp(),
  });
}