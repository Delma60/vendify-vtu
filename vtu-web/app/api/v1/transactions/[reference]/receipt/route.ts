// vtu-web/app/api/v1/transactions/[reference]/receipt/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { err } from '@/lib/utils/response';
import { getOrCreateReceipt } from '@/lib/wallet/receipt';
import type { Transaction } from '@/types';

/**
 * GET /api/v1/transactions/:reference/receipt
 * Returns a redirect to the PDF/HTML receipt download URL.
 * The receipt is generated on demand if it hasn't been created yet.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { reference } = await params;
  if (!reference) return err('Reference is required', 400);

  // Resolve the transaction ID from the reference
  const snap = await adminDb
    .collection('transactions')
    .where('userId', '==', session.uid)
    .where('reference', '==', reference)
    .limit(1)
    .get();

  if (snap.empty) return err('Transaction not found', 404);

  const txn = snap.docs[0].data() as Transaction;

  if (txn.status === 'pending') {
    return err('Receipt is not yet available for pending transactions.', 400);
  }

  const receiptUrl = await getOrCreateReceipt(txn.id, session.uid);

  if (!receiptUrl) {
    return err('Receipt generation failed. Please try again later.', 500);
  }

  return NextResponse.redirect(receiptUrl);
}