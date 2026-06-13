// vtu-web/app/api/v1/wallet/fund/route.ts
// AGENTS.md RULES: #4 (zod), #5 (idempotency), #9 (log every external call)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { post as flwPost } from '@/lib/flutterwave/client';
import { generateReference } from '@/lib/utils/reference';
import type { User, Wallet } from '@/types';

const FundWalletSchema = z.object({
  amount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(100_00, 'Minimum funding amount is ₦100')
    .max(10_000_000_00, 'Maximum single funding is ₦10,000,000'),
  paymentMethod: z.enum(['card', 'bank_transfer', 'ussd']).default('card'),
  redirectUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = FundWalletSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { amount, paymentMethod, redirectUrl } = parsed.data;

  // Load user
  const [userSnap, walletSnap] = await Promise.all([
    adminDb.collection('users').doc(session.uid).get(),
    adminDb.collection('wallets').doc(session.uid).get(),
  ]);

  if (!userSnap.exists || !walletSnap.exists) return err('Account not found', 404);

  const user = userSnap.data() as User;
  const wallet = walletSnap.data() as Wallet;

  const txRef = generateReference('wallet_fund');
  const amountNaira = amount / 100; // Flutterwave expects Naira

  const payload = {
    tx_ref: txRef,
    amount: amountNaira,
    currency: 'NGN',
    redirect_url: redirectUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?funded=1`,
    payment_options: paymentMethod,
    customer: {
      email: user.email,
      phonenumber: user.phone,
      name: user.displayName,
    },
    meta: {
      userId: session.uid,
    },
    customizations: {
      title: `${process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro'} Wallet Funding`,
      description: 'Fund your wallet',
    },
  };

  const response = await flwPost('/v3/payments', JSON.stringify(payload));

  if (response.status !== 'success') {
    return err('Failed to initiate payment. Please try again.', 502);
  }

  const data = response.data as { link: string };

  return ok({
    paymentLink: data.link,
    txRef,
    amountKobo: amount,
    currency: 'NGN',
  });
}