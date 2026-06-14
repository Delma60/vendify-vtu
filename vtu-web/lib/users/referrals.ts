// vtu-web/lib/users/referrals.ts
// AGENTS.md RULES: #9 (log every external call), #13 (config from Firestore)

import { adminDb } from '@/lib/firebase/admin';
import type { User } from '@/types';

export interface ReferralLevel {
  userId: string;
  displayName: string;
  email: string;
  level: number; // 1 = direct referrer, 2 = their referrer, 3 = ...
}

/**
 * Walk the referral chain for a given user and return up to `maxLevels` ancestors.
 * Level 1 = the user who referred this user directly.
 * Level 2 = who referred Level 1, etc.
 *
 * Capped at 3 levels to prevent runaway reads.
 */
export async function getReferralHierarchy(
  userId: string,
  maxLevels = 3
): Promise<ReferralLevel[]> {
  const chain: ReferralLevel[] = [];
  let currentUserId = userId;

  for (let level = 1; level <= maxLevels; level++) {
    const snap = await adminDb.collection('users').doc(currentUserId).get();
    if (!snap.exists) break;

    const user = snap.data() as User;
    if (!user.referredBy) break;

    const referrerSnap = await adminDb.collection('users').doc(user.referredBy).get();
    if (!referrerSnap.exists) break;

    const referrer = referrerSnap.data() as User;

    // Skip inactive/frozen referrers — they don't earn
    if (!referrer.isActive || referrer.isFrozen) {
      // Still follow the chain upward — their referrer might still earn
      currentUserId = user.referredBy;
      continue;
    }

    chain.push({
      userId: user.referredBy,
      displayName: referrer.displayName,
      email: referrer.email,
      level,
    });

    currentUserId = user.referredBy;
  }

  return chain;
}