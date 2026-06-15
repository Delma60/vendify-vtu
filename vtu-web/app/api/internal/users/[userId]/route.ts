// vtu-web/app/api/internal/users/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requirePermission, handleAuthError, PERMISSIONS } from '@/lib/roles/middleware';
import type { User, Wallet } from '@/types';

function errRes(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * GET /api/internal/users/[userId]
 *
 * Returns a single user document with their wallet, subscription status,
 * and referral count in one round-trip.
 *
 * Requires: users:read permission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.USERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { userId } = await params;
  if (!userId?.trim()) return errRes('userId is required', 400);

  try {
    // Parallel reads — user + wallet + referral count
    const [userSnap, walletSnap, referralSnap] = await Promise.all([
      adminDb.collection('users').doc(userId).get(),
      adminDb.collection('wallets').doc(userId).get(),
      adminDb
        .collection('users')
        .where('referredBy', '==', userId)
        .count()
        .get()
        .catch(() => null),
    ]);

    if (!userSnap.exists) return errRes('User not found', 404);

    const user = { uid: userSnap.id, ...userSnap.data() } as User;
    const wallet = walletSnap.exists ? (walletSnap.data() as Wallet) : null;
    const referralCount = referralSnap?.data().count ?? 0;

    // Strip bcrypt hash from response — never expose it
    const { transactionPin: _pin, ...safeUser } = user as User & { transactionPin?: string };

    return NextResponse.json({
      success: true,
      data: {
        user: { ...safeUser, transactionPin: _pin ? '[SET]' : null },
        wallet,
        referralCount,
      },
    });
  } catch (e: unknown) {
    console.error('[GET /api/internal/users/[userId]]', e);
    return errRes('Failed to load user', 500);
  }
}