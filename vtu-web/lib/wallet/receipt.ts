// vtu-web/lib/wallet/receipt.ts
// AGENTS.md RULES: #9 (log), #11 (emulator)
// Generates a lightweight PDF receipt for a completed transaction.
// Uses a simple HTML-to-PDF approach via node-html-to-pdf (jsPDF on server)
// compatible with Next.js Server Components and API routes.
//
// Receipts are stored in Firebase Storage at receipts/{userId}/{txnId}.pdf
// and the download URL is written back to the transaction document.

import { adminDb } from '@/lib/firebase/admin';
import { koboToNaira, formatDate } from '@/lib/utils/formatter';
import type { Transaction, User } from '@/types';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

// ─── HTML TEMPLATE ─────────────────────────────────────────────────────────────

function buildReceiptHtml(txn: Transaction, user: User): string {
  const date = formatDate(
    txn.createdAt instanceof Timestamp
      ? txn.createdAt.toDate()
      : new Date(txn.createdAt as unknown as string)
  );
  const typeLabel = txn.type === 'credit' ? 'Credit' : 'Debit';
  const categoryLabel = (txn.category as string)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; max-width: 520px; margin: 40px auto; color: #1f2937; font-size: 13px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    td:first-child { color: #6b7280; width: 40%; }
    td:last-child { font-weight: 500; }
    .status-success { color: #059669; }
    .status-failed { color: #dc2626; }
    .status-pending { color: #d97706; }
    .divider { border: none; border-top: 1px dashed #e5e7eb; margin: 20px 0; }
    .footer { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 32px; }
    .amount { font-size: 22px; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-credit { background: #d1fae5; color: #065f46; }
    .badge-debit  { background: #fee2e2; color: #7f1d1d; }
  </style>
</head>
<body>
  <h1>${APP_NAME}</h1>
  <div class="subtitle">Transaction Receipt</div>

  <div class="amount">${koboToNaira(txn.amount)}</div>
  <span class="badge badge-${txn.type}">${typeLabel}</span>

  <hr class="divider"/>

  <table>
    <tr><td>Reference</td><td>${txn.reference}</td></tr>
    <tr><td>Date &amp; time</td><td>${date}</td></tr>
    <tr><td>Service</td><td>${categoryLabel}</td></tr>
    <tr><td>Status</td>
      <td class="status-${txn.status}">${txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}</td>
    </tr>
    ${txn.fee > 0 ? `<tr><td>Fee</td><td>${koboToNaira(txn.fee)}</td></tr>` : ''}
    ${txn.fee > 0 ? `<tr><td>Total</td><td>${koboToNaira(txn.amount)}</td></tr>` : ''}
    <tr><td>Balance before</td><td>${koboToNaira(txn.balanceBefore)}</td></tr>
    <tr><td>Balance after</td><td>${koboToNaira(txn.balanceAfter)}</td></tr>
    ${txn.providerReference ? `<tr><td>Provider ref</td><td>${txn.providerReference}</td></tr>` : ''}
  </table>

  <hr class="divider"/>

  <table>
    <tr><td>Account name</td><td>${user.displayName}</td></tr>
    <tr><td>Account email</td><td>${user.email}</td></tr>
  </table>

  <div class="footer">
    This is an official receipt from ${APP_NAME}.<br/>
    ${APP_URL} &bull; ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}

// ─── GENERATE AND STORE RECEIPT ────────────────────────────────────────────────

/**
 * Generate a PDF receipt for a transaction and store it in Firebase Storage.
 * Returns the public download URL and writes it to transactions/{txnId}.receiptUrl.
 *
 * Falls back gracefully — if PDF generation fails the transaction is unaffected.
 *
 * Note: Requires the firebase-admin Storage bucket to be configured and the
 * `html-pdf-node` package to be installed. In environments where puppeteer
 * is unavailable (Vercel Edge), this should be moved to a Cloud Function.
 */
export async function generateTransactionReceipt(
  txnId: string
): Promise<string | null> {
  try {
    const [txnSnap, ] = await Promise.all([
      adminDb.collection('transactions').doc(txnId).get(),
    ]);

    if (!txnSnap.exists) return null;
    const txn = txnSnap.data() as Transaction;

    const userSnap = await adminDb.collection('users').doc(txn.userId).get();
    if (!userSnap.exists) return null;
    const user = userSnap.data() as User;

    const html = buildReceiptHtml(txn, user);

    // Attempt PDF generation via html-pdf-node (must be installed)
    // Falls back to storing HTML receipt if PDF unavailable
    let buffer: Buffer;
    try {
      const htmlPdf = await import('html-pdf-node').catch(() => null);
      if (htmlPdf) {
        buffer = await new Promise<Buffer>((resolve, reject) => {
          const file = { content: html };
          (htmlPdf as any).generatePdf(file, { format: 'A4' }, (err: Error | null, buf: Buffer) => {
            if (err) reject(err);
            else resolve(buf);
          });
        });
      } else {
        // Fallback: store as HTML (viewable in browser)
        buffer = Buffer.from(html, 'utf-8');
      }
    } catch {
      buffer = Buffer.from(html, 'utf-8');
    }

    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50; // %P = PDF magic bytes
    const ext = isPdf ? 'pdf' : 'html';
    const contentType = isPdf ? 'application/pdf' : 'text/html';

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const filePath = `receipts/${txn.userId}/${txnId}.${ext}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'private, max-age=31536000' },
    });

    // Make publicly readable with a signed URL (7-year expiry)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 365 * 24 * 60 * 60 * 1000,
    });

    // Persist URL on transaction
    await adminDb.collection('transactions').doc(txnId).update({
      receiptUrl: url,
      updatedAt: Timestamp.now(),
    });

    return url;
  } catch (error) {
    console.error('[receipt:generate]', txnId, error);
    return null;
  }
}

// ─── GET OR CREATE RECEIPT ────────────────────────────────────────────────────

/**
 * Return the existing receipt URL for a transaction, generating it on demand
 * if it has not yet been created.
 */
export async function getOrCreateReceipt(txnId: string, userId: string): Promise<string | null> {
  const snap = await adminDb.collection('transactions').doc(txnId).get();
  if (!snap.exists) return null;

  const txn = snap.data() as Transaction;
  if (txn.userId !== userId) return null; // ownership check

  if (txn.receiptUrl) return txn.receiptUrl;

  // Generate on demand
  return generateTransactionReceipt(txnId);
}