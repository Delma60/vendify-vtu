// vtu-web/lib/cashback/trigger.ts
// Bridge called from debitWallet's non-blocking post-commit block.
// Loads the transaction, then delegates to triggerCashback(txn) in the engine.

import { adminDb } from '@/lib/firebase/admin';
import { triggerCashback } from './engine';
import type { Transaction } from '@/types';

/**
 * Called from debitWallet with (userId, txnId).
 * Resolves the full transaction document then hands off to the cashback engine.
 * Never throws — all errors are swallowed so they cannot affect the caller.
 */
export async function triggerCashbackForTxn(
  _userId: string,
  txnId: string,
): Promise<void> {
  try {
    const snap = await adminDb.collection('transactions').doc(txnId).get();
    if (!snap.exists) return;
    const txn = snap.data() as Transaction;
    await triggerCashback(txn);
  } catch (err) {
    console.error('[cashback:trigger-bridge]', txnId, err);
  }
}