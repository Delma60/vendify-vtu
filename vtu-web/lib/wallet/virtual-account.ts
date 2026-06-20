// vtu-web/lib/wallet/virtual-account.ts
// AGENTS.md RULES: #3 (payments go through lib/payments/router.ts), #9 (log external calls — handled inside the gateway)
//
// Called from BOTH the registration flow and the login flow:
//   - Registration: best-effort attempt right after the user + wallet docs exist.
//   - Login: fallback retry if registration's attempt didn't work (gateway down,
//     etc.) — cheap to call every login since it short-circuits on a single
//     Firestore read once the account exists.
//
// Never throws — a payment gateway outage should never block someone from
// registering or logging in.

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createVirtualAccount } from '@/lib/payments/router';

interface UserRecordForVA {
  uid: string;
  email: string;
  phone: string;
  displayName?: string;
  bvn?: string; // optional until BVN verification (Phase 1) is wired up
}

export async function ensureVirtualAccount(user: UserRecordForVA): Promise<{ created: boolean }> {
  const walletRef = adminDb.collection('wallets').doc(user.uid);
  const walletSnap = await walletRef.get();

  // Already has one — nothing to do. This is the fast path login hits
  // every time for users who already have an account.
  if (walletSnap.exists && walletSnap.data()?.virtualAccountNumber) {
    return { created: false };
  }

  const [firstName, ...rest] = (user.displayName ?? user.email.split('@')[0]).split(' ');
  const lastName = rest.join(' ') || 'User';

  try {
    const account = await createVirtualAccount({
      userId: user.uid,
      email: user.email,
      phone: user.phone,
      bvn: user.bvn,
      firstName: firstName || 'User',
      lastName,
      // Stable reference (not per-attempt) so retrying on login looks up /
      // reuses the same Flutterwave order rather than minting duplicates.
      reference: `va-${user.uid}`,
    });

    await walletRef.set(
      {
        userId: user.uid,
        virtualAccountNumber: account.accountNumber,
        virtualAccountBank: account.bankName,
        virtualAccountRef: account.providerReference,
        virtualAccountPending: false,
        virtualAccountError: null,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return { created: true };
  } catch (error) {
    // Flag it instead of throwing — the next ensureVirtualAccount() call
    // (next login) will retry automatically.
    await walletRef.set(
      {
        userId: user.uid,
        virtualAccountPending: true,
        virtualAccountError: (error as Error).message,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    console.error(`[wallet] virtual account creation failed for ${user.uid}:`, (error as Error).message);
    return { created: false };
  }
}