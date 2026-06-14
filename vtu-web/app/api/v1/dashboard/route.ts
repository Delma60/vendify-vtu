// vtu-web/app/api/v1/dashboard/route.ts
// AGENTS.md RULES: #4 (zod), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { getWalletBalance } from '@/lib/wallet/operations';
import { getUserSubscriptionStatus } from '@/lib/subscriptions/plans';
import { getCommissionHistory } from '@/lib/commissions/engine';
import { ok, err } from '@/lib/utils/response';
import type { User, Transaction } from '@/types';

const QuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('7d'),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);
  const { range } = parsed.data;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const [userSnap, wallet, subscriptionStatus, commissionHistory, referralAgg] = await Promise.all([
    adminDb.collection('users').doc(session.uid).get(),
    getWalletBalance(session.uid),
    getUserSubscriptionStatus(session.uid),
    getCommissionHistory({ userId: session.uid, page: 1, pageSize: 1 }),
    adminDb.collection('users').where('referredBy', '==', session.uid).count().get().catch(() => null),
  ]);

  if (!userSnap.exists) return err('User not found', 404);
  if (!wallet) return err('Wallet not found', 404);
  const user = userSnap.data() as User;

  // ── Activity series: debit volume per day ──────────────────────────────────
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const txnSnap = await adminDb
    .collection('transactions')
    .where('userId', '==', session.uid)
    .where('type', '==', 'debit')
    .where('status', '==', 'success')
    .where('createdAt', '>=', Timestamp.fromDate(since))
    .orderBy('createdAt', 'asc')
    .get();

  const dayMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const doc of txnSnap.docs) {
    const txn = doc.data() as Transaction;
    const key = txn.createdAt.toDate().toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + txn.amount);
  }

  const series = Array.from(dayMap.entries()).map(([date, amountKobo]) => ({
    date,
    label: new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    amountKobo,
  }));

  const todayKey = new Date().toISOString().slice(0, 10);

  // ── Recent transactions ─────────────────────────────────────────────────────
  const recentSnap = await adminDb
    .collection('transactions')
    .where('userId', '==', session.uid)
    .orderBy('createdAt', 'desc')
    .limit(6)
    .get();

  const recentTransactions = recentSnap.docs.map(d => {
    const t = d.data() as Transaction;
    return {
      id: t.id,
      type: t.type,
      category: t.category,
      amountKobo: t.amount,
      status: t.status,
      reference: t.reference,
      createdAt: t.createdAt.toMillis(),
    };
  });

  // ── Lifetime cashback ────────────────────────────────────────────────────────
  const cashbackSnap = await adminDb
    .collection('cashback_records')
    .where('userId', '==', session.uid)
    .where('status', '==', 'credited')
    .get();
  const cashbackTotalKobo = cashbackSnap.docs.reduce(
    (sum, d) => sum + (d.data().cashbackAmountKobo as number), 0
  );

  return ok({
    user: {
      displayName: user.displayName,
      email: user.email,
      kycTier: user.kycTier,
      referralCode: user.referralCode,
      hasBucket: user.hasBucket,
    },
    wallet: {
      balanceKobo: wallet.balance,
      lockedBalanceKobo: wallet.lockedBalance,
      virtualAccountNumber: wallet.virtualAccountNumber || null,
      virtualAccountBank: wallet.virtualAccountBank || null,
    },
    subscription: {
      planName: subscriptionStatus.planName,
      isActive: subscriptionStatus.isActive,
      daysRemaining: subscriptionStatus.daysRemaining,
    },
    commissions: {
      totalPendingKobo: commissionHistory.totalPending,
      totalCreditedKobo: commissionHistory.totalCredited,
    },
    cashback: {
      lifetimeTotalKobo: cashbackTotalKobo,
    },
    referrals: {
      count: referralAgg?.data().count ?? 0,
    },
    activity: {
      range,
      series,
      totalKobo: series.reduce((s, d) => s + d.amountKobo, 0),
      todaySpendKobo: dayMap.get(todayKey) ?? 0,
    },
    recentTransactions,
  });
}