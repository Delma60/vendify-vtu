// vtu-web/lib/wallet/operations.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops through here ONLY), #5 (idempotency), #7 (fraud score), #8 (never hard-delete)
// ALL wallet changes go through these functions. Never write to wallets directly.

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateReference } from '@/lib/utils/reference';
import type { Transaction, Wallet, User, TransactionCategory } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionInput {
  category: TransactionCategory | string;
  status?: Transaction['status'];
  reference?: string;
  providerReference?: string;
  provider?: string | null;
  fee?: number;
  metadata?: Record<string, unknown>;
  failureReason?: string;
}

export interface QueryTransactionsOptions {
  userId: string;
  category?: string;
  status?: Transaction['status'];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

// ─── Custom errors ────────────────────────────────────────────────────────────

export class WalletError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

// ─── GET WALLET BALANCE ───────────────────────────────────────────────────────

export async function getWalletBalance(userId: string): Promise<Wallet | null> {
  const snap = await adminDb.collection('wallets').doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as Wallet;
}

// ─── DEBIT WALLET ─────────────────────────────────────────────────────────────

/**
 * Atomically debit a user's wallet and create a transaction record.
 * Includes: idempotency check, spending limit enforcement, fraud scoring.
 *
 * @returns transaction document ID
 */
export async function debitWallet(
  userId: string,
  amountKobo: number,
  txnData: TransactionInput,
  idempotencyKey?: string
): Promise<string> {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new WalletError('Amount must be a positive integer in kobo', 'INVALID_AMOUNT');
  }

  // 1. Idempotency check
  if (idempotencyKey) {
    const existing = await adminDb
      .collection('transactions')
      .where('idempotencyKey', '==', idempotencyKey)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new WalletError('Duplicate transaction', 'DUPLICATE_TRANSACTION');
    }
  }

  // 2. Fraud score
  const { scoreTransaction } = await import('@/lib/fraud/scorer').catch(() => ({
    scoreTransaction: async () => 0,
  }));

  const fraudScore = await scoreTransaction({
    userId,
    amount: amountKobo,
    service: txnData.category as string,
    ip: (txnData.metadata?.ip as string) ?? '0.0.0.0',
  }).catch(() => 0);

  if (fraudScore > 70) {
    throw new WalletError('Transaction blocked due to risk flags', 'FRAUD_BLOCKED');
  }

  // 3. Atomic Firestore transaction
  const txnRef = adminDb.collection('transactions').doc();
  let txnId = txnRef.id;

  await adminDb.runTransaction(async (firestoreTxn) => {
    const walletRef = adminDb.collection('wallets').doc(userId);
    const userRef = adminDb.collection('users').doc(userId);

    const [walletSnap, userSnap] = await Promise.all([
      firestoreTxn.get(walletRef),
      firestoreTxn.get(userRef),
    ]);

    if (!walletSnap.exists) throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND');

    const wallet = walletSnap.data() as Wallet;
    const user = userSnap.data() as User;

    // Balance check
    if (wallet.balance < amountKobo) {
      throw new WalletError('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
    }

    // Spending limits
    const today = new Date().toISOString().slice(0, 10);
    const limits = user.spendingLimits;

    const dailyLimit = limits?.dailyLimit ?? getKycDailyLimit(user.kycTier);
    const weeklyLimit = limits?.weeklyLimit ?? null;

    // Reset daily counter if needed
    const dailySpent =
      limits?.lastResetDate === today ? (limits?.dailySpent ?? 0) : 0;

    if (dailyLimit !== null && dailySpent + amountKobo > dailyLimit) {
      throw new WalletError(
        `Daily spending limit of ₦${(dailyLimit / 100).toFixed(2)} exceeded`,
        'SPENDING_LIMIT_EXCEEDED'
      );
    }

    if (weeklyLimit !== null && (limits?.weeklySpent ?? 0) + amountKobo > weeklyLimit) {
      throw new WalletError(
        `Weekly spending limit of ₦${(weeklyLimit / 100).toFixed(2)} exceeded`,
        'SPENDING_LIMIT_EXCEEDED'
      );
    }

    const newBalance = wallet.balance - amountKobo;
    const fee = txnData.fee ?? 0;

    // Write wallet update
    firestoreTxn.update(walletRef, {
      balance: newBalance,
      totalSpent: FieldValue.increment(amountKobo),
      updatedAt: Timestamp.now(),
    });

    // Update spending counters
    firestoreTxn.update(userRef, {
      'spendingLimits.dailySpent': FieldValue.increment(amountKobo),
      'spendingLimits.weeklySpent': FieldValue.increment(amountKobo),
      'spendingLimits.lastResetDate': today,
      updatedAt: Timestamp.now(),
    });

    // Write transaction
    firestoreTxn.set(txnRef, {
      id: txnRef.id,
      userId,
      type: 'debit',
      category: txnData.category,
      amount: amountKobo,
      fee,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: txnData.status ?? 'pending',
      reference: txnData.reference ?? generateReference(txnData.category as string),
      providerReference: txnData.providerReference ?? null,
      provider: txnData.provider ?? null,
      metadata: txnData.metadata ?? {},
      failureReason: txnData.failureReason ?? null,
      retryCount: 0,
      fraudScore,
      isApiTransaction: false,
      apiKeyId: null,
      idempotencyKey: idempotencyKey ?? null,
      receiptUrl: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } satisfies Transaction);
  });

  // 4. Post-commit async tasks (fire and forget)
  Promise.all([
    triggerCommissionsAsync(userId, txnId),
    triggerCashbackAsync(userId, txnId),
    checkLowBalanceAsync(userId),
    sendTransactionEmailAsync(userId, txnId, 'debit'),
  ]).catch(console.error);

  return txnId;
}

// ─── CREDIT WALLET ────────────────────────────────────────────────────────────

export async function creditWallet(
  userId: string,
  amountKobo: number,
  txnData: TransactionInput
): Promise<string> {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new WalletError('Amount must be a positive integer in kobo', 'INVALID_AMOUNT');
  }

  const txnRef = adminDb.collection('transactions').doc();

  await adminDb.runTransaction(async (firestoreTxn) => {
    const walletRef = adminDb.collection('wallets').doc(userId);
    const walletSnap = await firestoreTxn.get(walletRef);

    if (!walletSnap.exists) throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND');

    const wallet = walletSnap.data() as Wallet;
    const newBalance = wallet.balance + amountKobo;

    firestoreTxn.update(walletRef, {
      balance: newBalance,
      totalFunded: txnData.category === 'wallet_fund'
        ? FieldValue.increment(amountKobo)
        : wallet.totalFunded,
      updatedAt: Timestamp.now(),
    });

    firestoreTxn.set(txnRef, {
      id: txnRef.id,
      userId,
      type: 'credit',
      category: txnData.category,
      amount: amountKobo,
      fee: 0,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: txnData.status ?? 'success',
      reference: txnData.reference ?? generateReference(txnData.category as string),
      providerReference: txnData.providerReference ?? null,
      provider: txnData.provider ?? null,
      metadata: txnData.metadata ?? {},
      failureReason: null,
      retryCount: 0,
      fraudScore: 0,
      isApiTransaction: false,
      apiKeyId: null,
      idempotencyKey: null,
      receiptUrl: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } satisfies Transaction);
  });

  sendTransactionEmailAsync(userId, txnRef.id, 'credit').catch(console.error);

  return txnRef.id;
}

// ─── UPDATE TRANSACTION STATUS ────────────────────────────────────────────────

export async function updateTransactionStatus(
  txnId: string,
  status: Transaction['status'],
  extra?: {
    provider?: string;
    providerReference?: string;
    failureReason?: string;
  }
): Promise<void> {
  await adminDb.collection('transactions').doc(txnId).update({
    status,
    ...(extra?.provider ? { provider: extra.provider } : {}),
    ...(extra?.providerReference ? { providerReference: extra.providerReference } : {}),
    ...(extra?.failureReason ? { failureReason: extra.failureReason } : {}),
    updatedAt: Timestamp.now(),
  });
}

// ─── FREEZE / UNFREEZE ────────────────────────────────────────────────────────

export async function freezeWallet(userId: string): Promise<void> {
  await adminDb.collection('users').doc(userId).update({
    isFrozen: true,
    updatedAt: Timestamp.now(),
  });
}

export async function unfreezeWallet(userId: string): Promise<void> {
  await adminDb.collection('users').doc(userId).update({
    isFrozen: false,
    updatedAt: Timestamp.now(),
  });
}

// ─── QUERY TRANSACTIONS ───────────────────────────────────────────────────────

export async function queryTransactions(
  opts: QueryTransactionsOptions
): Promise<{ transactions: Transaction[]; page: number; pageSize: number; hasMore: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);

  let query = adminDb
    .collection('transactions')
    .where('userId', '==', opts.userId)
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (opts.category) query = query.where('category', '==', opts.category);
  if (opts.status) query = query.where('status', '==', opts.status);
  if (opts.startDate) query = query.where('createdAt', '>=', Timestamp.fromDate(opts.startDate));
  if (opts.endDate) query = query.where('createdAt', '<=', Timestamp.fromDate(opts.endDate));

  const snap = await query.limit(pageSize + 1).offset((page - 1) * pageSize).get();
  const hasMore = snap.docs.length > pageSize;

  return {
    transactions: snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() }) as Transaction),
    page,
    pageSize,
    hasMore,
  };
}

// ─── SPENDING LIMIT RESET (cron) ─────────────────────────────────────────────

export async function resetSpendingLimits(): Promise<{ usersReset: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const snap = await adminDb
    .collection('users')
    .where('spendingLimits.lastResetDate', '<', today)
    .limit(500)
    .get();

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = adminDb.batch();
  let opCount = 0;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      'spendingLimits.dailySpent': 0,
      'spendingLimits.lastResetDate': today,
      updatedAt: Timestamp.now(),
    });
    opCount++;
    if (opCount >= 490) {
      batches.push(batch);
      batch = adminDb.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) batches.push(batch);
  await Promise.all(batches.map(b => b.commit()));

  return { usersReset: snap.size };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getKycDailyLimit(tier: 0 | 1 | 2 | 3): number | null {
  const limits: Record<number, number | null> = {
    0: 500_000,       // ₦5,000
    1: 5_000_000,     // ₦50,000
    2: 50_000_000,    // ₦500,000
    3: null,          // unlimited
  };
  return limits[tier] ?? 500_000;
}

async function triggerCommissionsAsync(userId: string, txnId: string): Promise<void> {
  const { triggerCommissions } = await import('@/lib/commissions/engine');
  await triggerCommissions(userId, txnId);
}

async function triggerCashbackAsync(userId: string, txnId: string): Promise<void> {
  const { triggerCashbackForTxn } = await import('@/lib/cashback/trigger');
  await triggerCashbackForTxn(userId, txnId);
}

async function checkLowBalanceAsync(userId: string): Promise<void> {
  const { checkAndNotifyLowBalance } = await import('@/lib/notifications/low-balance');
  await checkAndNotifyLowBalance(userId);
}

async function sendTransactionEmailAsync(
  userId: string,
  txnId: string,
  type: 'debit' | 'credit'
): Promise<void> {
  const { sendTransactionEmail } = await import('@/lib/notifications/transaction');
  await sendTransactionEmail(userId, txnId, type);
}