// vtu-web/app/api/v1/wallet/bank-accounts/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log every external call)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { FieldValue } from 'firebase-admin/firestore';
import { get as flwGet } from '@/lib/flutterwave/client';

const AddBankAccountSchema = z.object({
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  bankCode: z.string().min(2).max(10),
  bankName: z.string().min(2),
});

const RemoveBankAccountSchema = z.object({
  accountId: z.string().min(1),
});

interface BankAccount {
  id: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  isVerified: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

/** GET /api/v1/wallet/bank-accounts — list saved bank accounts */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const snap = await adminDb
    .collection('users')
    .doc(session.uid)
    .collection('bank_accounts')
    .orderBy('createdAt', 'desc')
    .get();

  const accounts: BankAccount[] = snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<BankAccount, 'id'>),
  }));

  return ok({ accounts });
}

/** POST /api/v1/wallet/bank-accounts — add and verify a bank account */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = AddBankAccountSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { accountNumber, bankCode, bankName } = parsed.data;

  // Verify account name via Flutterwave
  const verifyResponse = await flwGet(
    `/v3/accounts/resolve?account_number=${accountNumber}&account_bank=${bankCode}`
  );

  let accountName = '';
  let isVerified = false;

  if (verifyResponse.status === 'success') {
    const data = verifyResponse.data as { account_name: string };
    accountName = data.account_name;
    isVerified = true;
  }

  if (!isVerified) {
    return err('Could not verify bank account. Please check account number and bank.', 400, 'VERIFICATION_FAILED');
  }

  // Check for duplicates
  const existing = await adminDb
    .collection('users')
    .doc(session.uid)
    .collection('bank_accounts')
    .where('accountNumber', '==', accountNumber)
    .where('bankCode', '==', bankCode)
    .limit(1)
    .get();

  if (!existing.empty) {
    return err('This bank account is already saved.', 409);
  }

  // Save account
  const ref = adminDb
    .collection('users')
    .doc(session.uid)
    .collection('bank_accounts')
    .doc();

  await ref.set({
    accountNumber,
    bankCode,
    bankName,
    accountName,
    isVerified: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ok(
    {
      id: ref.id,
      accountNumber,
      bankCode,
      bankName,
      accountName,
      isVerified: true,
    },
    'Bank account added successfully.',
    201
  );
}

/** DELETE /api/v1/wallet/bank-accounts — remove a saved bank account */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = RemoveBankAccountSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { accountId } = parsed.data;

  const ref = adminDb
    .collection('users')
    .doc(session.uid)
    .collection('bank_accounts')
    .doc(accountId);

  const snap = await ref.get();
  if (!snap.exists) return err('Bank account not found.', 404);

  await ref.delete();

  return ok(null, 'Bank account removed.');
}