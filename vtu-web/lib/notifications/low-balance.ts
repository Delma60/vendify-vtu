// vtu-web/lib/notifications/low-balance.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log), #11 (emulator)
// Called after every debit transaction to check if the user's balance has
// dropped below their configured threshold (or the platform default).

import { adminDb } from '@/lib/firebase/admin';
import { sendMail } from '@/lib/mail/client';
import { koboToNaira } from '@/lib/utils/formatter';
import type { User, Wallet } from '@/types';

const DEFAULT_LOW_BALANCE_THRESHOLD_KOBO = 100_000; // ₦1,000

/**
 * Check if the user's wallet has fallen below their low-balance alert threshold
 * after a debit, and notify them if so.
 *
 * This should be called non-blockingly after debitWallet completes.
 */
export async function checkAndNotifyLowBalance(userId: string): Promise<void> {
  try {
    const [userSnap, walletSnap] = await Promise.all([
      adminDb.collection('users').doc(userId).get(),
      adminDb.collection('wallets').doc(userId).get(),
    ]);

    if (!userSnap.exists || !walletSnap.exists) return;

    const user = userSnap.data() as User;
    const wallet = walletSnap.data() as Wallet;

    // Load threshold from system settings, fall back to ₦1,000
    const settingsSnap = await adminDb.collection('system_settings').doc('global').get();
    const settings = settingsSnap.data() as
      | { lowBalanceAlertThreshold?: number }
      | undefined;

    const threshold =
      settings?.lowBalanceAlertThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD_KOBO;

    if (wallet.balance > threshold) return;

    // Avoid spamming — only send once per day using a subcollection flag
    const today = new Date().toISOString().slice(0, 10);
    const flagRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('notification_flags')
      .doc(`low_balance_${today}`);

    const flagSnap = await flagRef.get();
    if (flagSnap.exists) return; // already notified today

    await flagRef.set({ sentAt: new Date().toISOString() });

    if (user.notifications.email) {
      await sendLowBalanceEmail(user, wallet.balance, threshold);
    }

    // Future: push + WhatsApp + SMS can be added here
  } catch (error) {
    console.error('[low-balance-check]', error);
  }
}

async function sendLowBalanceEmail(
  user: User,
  currentBalance: number,
  threshold: number
): Promise<void> {
  const balanceStr = koboToNaira(currentBalance);
  const thresholdStr = koboToNaira(threshold);
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await sendMail({
    to: user.email,
    subject: `⚠️ Low wallet balance — ${balanceStr} remaining`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Low balance alert</h2>
        <p>Hi ${user.displayName},</p>
        <p>Your ${appName} wallet balance has fallen below your alert threshold of
        <strong>${thresholdStr}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Current balance</td>
            <td style="padding:8px;font-weight:600">${balanceStr}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Alert threshold</td>
            <td style="padding:8px">${thresholdStr}</td>
          </tr>
        </table>
        <a href="${appUrl}/dashboard/wallet"
           style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Fund your wallet
        </a>
        <p style="color:#6b7280;font-size:13px">
          You can adjust your low balance alert threshold in your account settings.
        </p>
      </div>
    `,
    text: `Your wallet balance is ${balanceStr}, below your alert threshold of ${thresholdStr}. Fund your wallet at ${appUrl}/dashboard/wallet`,
  });
}