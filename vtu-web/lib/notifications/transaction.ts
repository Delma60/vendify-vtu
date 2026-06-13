// vtu-web/lib/notifications/transaction.ts
// Sends email notifications for wallet transactions.

import { adminDb } from '@/lib/firebase/admin';
import { sendMail } from '@/lib/mail/client';
import { koboToNaira } from '@/lib/utils/formatter';
import type { Transaction, User } from '@/types';

export async function sendTransactionEmail(
  userId: string,
  txnId: string,
  type: 'debit' | 'credit'
): Promise<void> {
  const [userSnap, txnSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).get(),
    adminDb.collection('transactions').doc(txnId).get(),
  ]);

  if (!userSnap.exists || !txnSnap.exists) return;

  const user = userSnap.data() as User;
  const txn = txnSnap.data() as Transaction;

  if (!user.notifications.email) return;

  const isCredit = type === 'credit';
  const statusLabel = txn.status === 'success' ? 'Successful' : txn.status === 'failed' ? 'Failed' : 'Pending';
  const amountStr = koboToNaira(txn.amount);
  const balanceStr = koboToNaira(txn.balanceAfter);

  await sendMail({
    to: user.email,
    subject: `${isCredit ? 'Credit' : 'Debit'} Alert: ${amountStr} — ${statusLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Transaction ${statusLabel}</h2>
        <p>Hi ${user.displayName},</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Type</td>
            <td style="padding:8px;font-weight:600">${isCredit ? '+ Credit' : '− Debit'}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Amount</td>
            <td style="padding:8px;font-weight:600">${amountStr}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Service</td>
            <td style="padding:8px">${(txn.category as string).replace(/_/g, ' ')}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280">Reference</td>
            <td style="padding:8px;font-size:12px">${txn.reference}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280">Wallet Balance</td>
            <td style="padding:8px;font-weight:600">${balanceStr}</td>
          </tr>
        </table>
        ${txn.status === 'failed' && txn.failureReason
          ? `<p style="color:#ef4444">Reason: ${txn.failureReason}</p>`
          : ''
        }
        <p style="color:#6b7280;font-size:13px">
          If you did not initiate this transaction, contact support immediately.
        </p>
      </div>
    `,
    text: `${isCredit ? 'Credit' : 'Debit'} of ${amountStr} — ${statusLabel}. Balance: ${balanceStr}. Ref: ${txn.reference}`,
  });
}