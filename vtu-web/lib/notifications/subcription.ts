// vtu-web/lib/subscriptions/notifications.ts
// AGENTS.md RULES: #9 (log every external call)

import { sendMail } from '@/lib/mail/client';
import { koboToNaira } from '@/lib/utils/formatter';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function sendRenewalReminderEmail(params: {
  to: string;
  displayName: string;
  planName: string;
  expiresAt: Date;
  daysRemaining: number;
}): Promise<void> {
  const { to, displayName, planName, expiresAt, daysRemaining } = params;
  const dateStr = expiresAt.toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const urgency = daysRemaining === 1
    ? '⚠️ Your subscription expires <strong>tomorrow</strong>'
    : `Your subscription expires in <strong>${daysRemaining} days</strong>`;

  await sendMail({
    to,
    subject: `${APP_NAME} — Subscription expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2>Hi ${displayName},</h2>
        <p>${urgency} on <strong>${dateStr}</strong>.</p>
        <p>You're currently on the <strong>${planName}</strong> plan. Renew now to avoid being downgraded
        to the free tier and losing access to premium features.</p>
        <a href="${APP_URL}/dashboard/subscription"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;font-weight:600">
          Renew Subscription
        </a>
        <p style="color:#6b7280;font-size:13px">
          After expiry you'll have a 7-day grace period before your plan is downgraded.
        </p>
      </div>
    `,
    text: `Your ${planName} subscription expires in ${daysRemaining} days (${dateStr}). Renew at ${APP_URL}/dashboard/subscription`,
  });
}

export async function sendSubscriptionExpiredEmail(params: {
  to: string;
  displayName: string;
  planName: string;
}): Promise<void> {
  const { to, displayName, planName } = params;
  await sendMail({
    to,
    subject: `Your ${APP_NAME} ${planName} subscription has expired`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2>Hi ${displayName},</h2>
        <p>Your <strong>${planName}</strong> subscription has expired and your account has been
        downgraded to the Free plan.</p>
        <p>You can resubscribe at any time to restore your premium features.</p>
        <a href="${APP_URL}/dashboard/subscription"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;font-weight:600">
          Resubscribe
        </a>
      </div>
    `,
    text: `Your ${planName} subscription has expired. Resubscribe at ${APP_URL}/dashboard/subscription`,
  });
}

export async function sendSubscriptionPurchasedEmail(params: {
  to: string;
  displayName: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountKobo: number;
  expiresAt: Date;
}): Promise<void> {
  const { to, displayName, planName, billingCycle, amountKobo, expiresAt } = params;
  const dateStr = expiresAt.toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  await sendMail({
    to,
    subject: `You're now on ${APP_NAME} ${planName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2>Subscription confirmed 🎉</h2>
        <p>Hi ${displayName}, you've successfully subscribed to the <strong>${planName}</strong> plan.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Plan</td>
            <td style="padding:8px;font-weight:600">${planName}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Billing cycle</td>
            <td style="padding:8px">${billingCycle === 'annual' ? 'Annual' : 'Monthly'}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Amount charged</td>
            <td style="padding:8px;font-weight:600">${koboToNaira(amountKobo)}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Valid until</td>
            <td style="padding:8px">${dateStr}</td>
          </tr>
        </table>
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;font-weight:600">
          Go to Dashboard
        </a>
      </div>
    `,
    text: `Subscribed to ${planName} (${billingCycle}). Amount: ${koboToNaira(amountKobo)}. Valid until ${dateStr}.`,
  });
}