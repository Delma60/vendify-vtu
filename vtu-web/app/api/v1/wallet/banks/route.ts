// vtu-web/app/api/v1/wallet/banks/route.ts
// AGENTS.md RULES: #4 (zod), #14 (runtime config)
// Returns the list of Nigerian banks from Flutterwave.
// Cached in Firestore for 24 hours to avoid hammering the provider API.

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { listBanks } from '@/lib/flutterwave/payouts';
import { FieldValue } from 'firebase-admin/firestore';

const CACHE_TTL_HOURS = 24;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  // Check cache
  const cacheRef = adminDb.collection('system_cache').doc('banks_NG');
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists) {
    const cached = cacheSnap.data() as { banks: unknown[]; cachedAt: FirebaseFirestore.Timestamp };
    const age = (Date.now() - cached.cachedAt.toDate().getTime()) / (1000 * 60 * 60);
    if (age < CACHE_TTL_HOURS) {
      return ok({ banks: cached.banks, cached: true });
    }
  }

  // Fetch fresh from Flutterwave
  const banks = await listBanks('NG');
  if (!banks.length) {
    // Return stale cache if available, otherwise error
    if (cacheSnap.exists) {
      const stale = cacheSnap.data() as { banks: unknown[] };
      return ok({ banks: stale.banks, cached: true });
    }
    return err('Could not retrieve bank list. Please try again.', 502);
  }

  // Persist to cache
  await cacheRef.set({ banks, cachedAt: FieldValue.serverTimestamp() });

  return ok({ banks, cached: false });
}