// vtu-web/app/api/v1/balance/route.ts
// AGENTS.md RULES: #4 (zod), #11 (emulator only for testing), #13 (price from Firestore)

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWalletBalance } from '@/lib/wallet/operations';
import { ok, err } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const wallet = await getWalletBalance(session.uid);
  if (!wallet) return err('Wallet not found', 404);

  return ok({
    balance: wallet.balance,           // in kobo
    currency: wallet.currency,
    totalFunded: wallet.totalFunded,
    totalSpent: wallet.totalSpent,
    totalWithdrawn: wallet.totalWithdrawn,
    lockedBalance: wallet.lockedBalance,
    virtualAccountNumber: wallet.virtualAccountNumber,
    virtualAccountBank: wallet.virtualAccountBank,
  });
}