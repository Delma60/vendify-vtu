// vtu-web/app/api/v1/transactions/[reference]/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log)

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import type { Transaction } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { reference } = await params;
  if (!reference) return err('Reference is required', 400);

  // Try exact ID first (for internal use), then fall back to reference string
  let txn: Transaction | null = null;

  // Query by reference field
  const snap = await adminDb
    .collection('transactions')
    .where('userId', '==', session.uid)
    .where('reference', '==', reference)
    .limit(1)
    .get();

  if (!snap.empty) {
    txn = snap.docs[0].data() as Transaction;
  }

  if (!txn) return err('Transaction not found', 404);

  return ok(txn);
}