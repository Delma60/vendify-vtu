// vtu-web/lib/wallet/operations.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateReference } from '@/lib/utils/reference';
import type { Transaction, Wallet, User } from '@/types';

// ─── Custom errors ────────────────────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor() { super('Insufficient wallet balance'); }
}

export class SpendingLimitError extends Error {
  readonly code = 'SPENDING_LIMIT_EXCEEDED';
  constructor(public readonly period: 'daily' | 'weekly') {
    super(`${period === 'daily' ? 'Daily' : 'Weekly'} spending limit exceeded`);
  }
}

export class FraudError extends Error {
  readonly code = 'FRAUD_BLOCKED';
  constructor(public readonly score: number) {
    super('Transaction blocked by fraud detection');
  }
}

export class IdempotencyError extends Error {
  readonly code = 'DUPLICATE_TRANSACTION';
  constructor(public readonly existingTxnId: string) {
    super('Duplicate transaction detected');
  }
}

export class WalletNotFoundError extends Error {
  readonly code = 'WALLET_NOT_FOUND';
  constructor() { super('Wallet not found'); }
}

// ─── Spending limit helpers ───────────────────────────────────────────────────

const DEFAULT_DAILY_LIMITS: Record<number, number | null> = {
  0: 50_000_00,   // ₦5,000 in kobo
  1: 500_000_00,  // ₦50,000 in kobo
  2: 5_000_000_00, // ₦500,000 in kobo
  3: null,         // unlimited
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

interface SpendingLimits {
  dailyLimit: number | null;
  weeklyLimit: number | null;
  dailySpent: number;
  weeklySpent: number;
  lastResetDate: string;
}

function shouldResetDaily(limits: SpendingLimits): boolean {
  return limits.lastResetDate < todayString();
}

function shouldResetWeekly(limits: SpendingLimits): boolean {
  return limits.lastResetDate < mondayString();
}

// ─── WALLET DEBIT ──────────────────────────────────────────────────────────────

export async function debitWallet(
  userId: string,
  amount: number,              // MUST be in kobo (integer)
  txnData: Partial<Transaction>,
  idempotencyKey?: string,
): Promise<string> {
  // 1. Idempotency check BEFORE the transaction
  if (idempotencyKey) {
    const existing = await adminDb
      .collection('transactions')
      .where('userId', '==', userId)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new IdempotencyError(existing.docs[0].id);
    }
  }

  // 2. Fraud score (outside Firestore txn — reads are cheap)
  let fraudScore = 0;
  try {
    const { scoreTransaction } = await import('@/lib/fraud/scorer');
    fraudScore = await scoreTransaction({
      userId,
      amount,
      service: txnData.category ?? 'unknown',
      ip: (txnData.metadata as Record<string, string>)?.ip,
    });
  } catch {
    // Non-blocking — don't fail the transaction if scorer is unavailable
  }

  if (fraudScore > 70) {
    // Flag user as high risk
    adminDb.collection('users').doc(userId).update({ riskLevel: 'high' }).catch(console.error);
    throw new FraudError(fraudScore);
  }

  // 3. Firestore atomic transaction
  const txnRef = adminDb.collection('transactions').doc();
  const txnId = txnRef.id;
  const walletRef = adminDb.collection('wallets').doc(userId);
  const userRef = adminDb.collection('users').doc(userId);

  await adminDb.runTransaction(async (firestoreTxn) => {
    const [walletSnap, userSnap] = await Promise.all([
      firestoreTxn.get(walletRef),
      firestoreTxn.get(userRef),
    ]);

    if (!walletSnap.exists) throw new WalletNotFoundError();

    const wallet = walletSnap.data() as Wallet;
    const user = userSnap.data() as User;
    const limits = user.spendingLimits;

    // Reset counters if stale
    const resetDaily = shouldResetDaily(limits);
    const resetWeekly = shouldResetWeekly(limits);
    const effectiveDailySpent = resetDaily ? 0 : limits.dailySpent;
    const effectiveWeeklySpent = resetWeekly ? 0 : limits.weeklySpent;

    // Resolve effective limits (user-set or KYC tier default)
    const effectiveDailyLimit =
      limits.dailyLimit ?? DEFAULT_DAILY_LIMITS[user.kycTier] ?? null;
    const effectiveWeeklyLimit = limits.weeklyLimit;

    // Check spending limits
    if (effectiveDailyLimit !== null && effectiveDailySpent + amount > effectiveDailyLimit) {
      throw new SpendingLimitError('daily');
    }
    if (effectiveWeeklyLimit !== null && effectiveWeeklySpent + amount > effectiveWeeklyLimit) {
      throw new SpendingLimitError('weekly');
    }

    // Check balance
    if (wallet.balance < amount) throw new InsufficientFundsError();

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    // Update wallet
    firestoreTxn.update(walletRef, {
      balance: balanceAfter,
      totalSpent: FieldValue.increment(amount),
      updatedAt: Timestamp.now(),
    });

    // Update spending counters
    firestoreTxn.update(userRef, {
      'spendingLimits.dailySpent': effectiveDailySpent + amount,
      'spendingLimits.weeklySpent': effectiveWeeklySpent + amount,
      'spendingLimits.lastResetDate': todayString(),
      updatedAt: Timestamp.now(),
    });

    // Create transaction document
    firestoreTxn.set(txnRef, {
      id: txnId,
      userId,
      type: 'debit',
      category: txnData.category ?? 'unknown',
      amount,
      fee: txnData.fee ?? 0,
      balanceBefore,
      balanceAfter,
      status: txnData.status ?? 'pending',
      reference: txnData.reference ?? generateReference(txnData.category ?? 'unknown'),
      providerReference: txnData.providerReference ?? null,
      provider: txnData.provider ?? null,
      metadata: txnData.metadata ?? {},
      failureReason: null,
      retryCount: 0,
      fraudScore,
      isApiTransaction: txnData.isApiTransaction ?? false,
      apiKeyId: txnData.apiKeyId ?? null,
      idempotencyKey: idempotencyKey ?? null,
      receiptUrl: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } satisfies Transaction);
  });

  // 4. Post-commit side effects (non-blocking)
  Promise.allSettled([
    import('@/lib/commissions/engine').then(m => m.triggerCommissions?.(userId, txnId)),
    import('@/lib/cashback/engine').then(m => m.triggerCashback?.(userId, txnId)),
    sendTxnNotification(userId, txnId, 'debit'),
  ]).catch(console.error);

  return txnId;
}

// ─── WALLET CREDIT ─────────────────────────────────────────────────────────────

export async function creditWallet(
  userId: string,
  amount: number,              // MUST be in kobo (integer)
  txnData: Partial<Transaction>,
): Promise<string> {
  const txnRef = adminDb.collection('transactions').doc();
  const txnId = txnRef.id;
  const walletRef = adminDb.collection('wallets').doc(userId);

  await adminDb.runTransaction(async (firestoreTxn) => {
    const walletSnap = await firestoreTxn.get(walletRef);
    if (!walletSnap.exists) throw new WalletNotFoundError();

    const wallet = walletSnap.data() as Wallet;
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    firestoreTxn.update(walletRef, {
      balance: balanceAfter,
      totalFunded: FieldValue.increment(amount),
      updatedAt: Timestamp.now(),
    });

    firestoreTxn.set(txnRef, {
      id: txnId,
      userId,
      type: 'credit',
      category: txnData.category ?? 'wallet_fund',
      amount,
      fee: 0,
      balanceBefore,
      balanceAfter,
      status: 'success',
      reference: txnData.reference ?? generateReference(txnData.category ?? 'wallet_fund'),
      providerReference: txnData.providerReference ?? null,
      provider: txnData.provider ?? null,
      metadata: txnData.metadata ?? {},
      failureReason: null,
      retryCount: 0,
      fraudScore: 0,
      isApiTransaction: txnData.isApiTransaction ?? false,
      apiKeyId: txnData.apiKeyId ?? null,
      idempotencyKey: txnData.idempotencyKey ?? null,
      receiptUrl: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } satisfies Transaction);
  });

  // Non-blocking notification
  sendTxnNotification(userId, txnId, 'credit').catch(console.error);

  return txnId;
}

// ─── BUCKET DEBIT ──────────────────────────────────────────────────────────────

export async function debitBucket(
  bucketId: string,
  units: number,
  txnData: Partial<Transaction>,
): Promise<string> {
  const bucketRef = adminDb.collection('buckets').doc(bucketId);
  const txnRef = adminDb.collection('transactions').doc();
  const txnId = txnRef.id;

  await adminDb.runTransaction(async (firestoreTxn) => {
    const bucketSnap = await firestoreTxn.get(bucketRef);
    if (!bucketSnap.exists) throw new Error('Bucket not found');

    const bucket = bucketSnap.data() as {
      userId: string;
      units: number;
      isActive: boolean;
      expiresAt: Timestamp;
      type: string;
    };

    if (!bucket.isActive) throw new Error('Bucket is inactive');
    if (bucket.expiresAt.toDate() < new Date()) throw new Error('Bucket has expired');
    if (bucket.units < units) throw new Error('Insufficient bucket units');

    const unitsBefore = bucket.units;
    const unitsAfter = unitsBefore - units;

    firestoreTxn.update(bucketRef, {
      units: unitsAfter,
      lastUsedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    firestoreTxn.set(txnRef, {
      id: txnId,
      userId: bucket.userId,
      type: 'debit',
      category: txnData.category ?? 'bucket_purchase',
      amount: txnData.amount ?? 0,
      fee: 0,
      balanceBefore: unitsBefore,
      balanceAfter: unitsAfter,
      status: 'success',
      reference: txnData.reference ?? generateReference('bucket_purchase'),
      providerReference: txnData.providerReference ?? null,
      provider: txnData.provider ?? null,
      metadata: { ...(txnData.metadata ?? {}), bucketId, units },
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

  return txnId;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface TransactionQueryOptions {
  userId: string;
  category?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function queryTransactions(opts: TransactionQueryOptions): Promise<{
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const { userId, category, status, startDate, endDate } = opts;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);

  let query = adminDb
    .collection('transactions')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc');

  if (category) query = query.where('category', '==', category) as typeof query;
  if (status) query = query.where('status', '==', status) as typeof query;
  if (startDate) query = query.where('createdAt', '>=', Timestamp.fromDate(startDate)) as typeof query;
  if (endDate) query = query.where('createdAt', '<=', Timestamp.fromDate(endDate)) as typeof query;

  const offset = (page - 1) * pageSize;
  const snap = await query.limit(pageSize + 1).offset(offset).get();

  const hasMore = snap.docs.length > pageSize;
  const docs = snap.docs.slice(0, pageSize).map(d => d.data() as Transaction);

  return { transactions: docs, total: -1, page, pageSize, hasMore };
}

export async function getWalletBalance(userId: string): Promise<Wallet | null> {
  const snap = await adminDb.collection('wallets').doc(userId).get();
  return snap.exists ? (snap.data() as Wallet) : null;
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function sendTxnNotification(
  userId: string,
  txnId: string,
  type: 'debit' | 'credit',
): Promise<void> {
  try {
    const { sendTransactionEmail } = await import('@/lib/notifications/transaction');
    await sendTransactionEmail(userId, txnId, type);
  } catch {
    // Non-critical
  }
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function queryTransactionsAdmin(opts: Omit<TransactionQueryOptions, 'userId'> & { userId?: string }) {
  let query = adminDb.collection('transactions').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (opts.userId) query = query.where('userId', '==', opts.userId);
  if (opts.category) query = query.where('category', '==', opts.category);
  if (opts.status) query = query.where('status', '==', opts.status);
  if (opts.startDate) query = query.where('createdAt', '>=', Timestamp.fromDate(opts.startDate));
  if (opts.endDate) query = query.where('createdAt', '<=', Timestamp.fromDate(opts.endDate));

  const pageSize = Math.min(100, opts.pageSize ?? 50);
  const page = Math.max(1, opts.page ?? 1);
  const snap = await query.limit(pageSize + 1).offset((page - 1) * pageSize).get();

  const hasMore = snap.docs.length > pageSize;
  return {
    transactions: snap.docs.slice(0, pageSize).map(d => d.data() as Transaction),
    page,
    pageSize,
    hasMore,
  };
}

export async function updateTransactionStatus(
  txnId: string,
  status: Transaction['status'],
  extra?: Partial<Transaction>,
): Promise<void> {
  await adminDb.collection('transactions').doc(txnId).update({
    status,
    ...extra,
    updatedAt: Timestamp.now(),
  });
}

// ─── Wallet freeze/unfreeze (admin) ──────────────────────────────────────────

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

// ─── Spending limit reset (cron) ──────────────────────────────────────────────

export async function resetSpendingLimits(): Promise<{ reset: number }> {
  const today = todayString();
  const monday = mondayString();

  const staleUsers = await adminDb
    .collection('users')
    .where('spendingLimits.lastResetDate', '<', today)
    .get();

  const batch = adminDb.batch();
  let count = 0;

  for (const doc of staleUsers.docs) {
    const user = doc.data() as User;
    const lastReset = user.spendingLimits.lastResetDate;
    const isWeekReset = lastReset < monday;

    batch.update(doc.ref, {
      'spendingLimits.dailySpent': 0,
      ...(isWeekReset ? { 'spendingLimits.weeklySpent': 0 } : {}),
      'spendingLimits.lastResetDate': today,
      updatedAt: Timestamp.now(),
    });
    count++;

    // Firestore batch limit
    if (count % 500 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  return { reset: count };
}