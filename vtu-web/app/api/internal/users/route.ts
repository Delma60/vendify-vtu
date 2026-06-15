// vtu-web/app/api/internal/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requirePermission, handleAuthError, PERMISSIONS } from '@/lib/roles/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRecord {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  roleId: string;
  kycTier: 0 | 1 | 2 | 3;
  isActive: boolean;
  isFrozen: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  subscriptionPlanId: string;
  createdAt: FirebaseFirestore.Timestamp | string;
  walletBalance?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── GET /api/internal/users ──────────────────────────────────────────────────
//
// Query params:
//   page        number (default 1)
//   pageSize    number (default 20, max 100)
//   search      string — matched against displayName, email, phone (prefix)
//   status      "active" | "frozen" | "suspended"
//   kycTier     "0" | "1" | "2" | "3"
//   riskLevel   "low" | "medium" | "high"
//
// Note: Firestore doesn't support OR queries or full-text search natively.
// "search" is handled by fetching a broader result set and filtering in-process
// when present. For production scale, swap to Algolia / Typesense.

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, PERMISSIONS.USERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = req.nextUrl;

  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
  const search   = searchParams.get('search')?.trim().toLowerCase() ?? '';
  const status   = searchParams.get('status')   ?? 'all';
  const kycTier  = searchParams.get('kycTier')  ?? 'all';
  const riskLevel = searchParams.get('riskLevel') ?? 'all';

  try {
    let query: FirebaseFirestore.Query = adminDb.collection('users').orderBy('createdAt', 'desc');

    // ── Server-side filters ──────────────────────────────────────────────────
    // Only apply filters that don't conflict with orderBy (Firestore restriction:
    // inequality filters on a field require that field to be the first orderBy).

    if (status === 'active')    query = query.where('isActive', '==', true).where('isFrozen', '==', false);
    if (status === 'frozen')    query = query.where('isFrozen', '==', true);
    if (status === 'suspended') query = query.where('isActive', '==', false);

    if (kycTier !== 'all')   query = query.where('kycTier', '==', parseInt(kycTier, 10));
    if (riskLevel !== 'all') query = query.where('riskLevel', '==', riskLevel);

    // When searching we need to over-fetch then filter — grab a larger window.
    const fetchLimit = search ? Math.min(500, pageSize * 20) : pageSize + 1;
    query = query.limit(fetchLimit);

    // Cursor-based pagination (only when not searching, since search needs full scan)
    if (!search && page > 1) {
      // We use page * pageSize offset via startAfter on the (page-1)*pageSize doc
      // Simple approach: re-fetch with offset. For large datasets, store cursors
      // in the session or use a lastVisible doc approach.
      const offsetSnap = await adminDb
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit((page - 1) * pageSize)
        .get();

      if (!offsetSnap.empty) {
        const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();
    let docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserRecord));

    // ── In-process search ────────────────────────────────────────────────────
    if (search) {
      docs = docs.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          u.phone?.includes(search)
      );

      // Manual pagination after filtering
      const start = (page - 1) * pageSize;
      const end   = start + pageSize;
      const hasMore = docs.length > end;
      docs = docs.slice(start, end);

      return NextResponse.json({
        success: true,
        data: {
          users: docs,
          pagination: { page, pageSize, hasMore },
        },
      });
    }

    // ── Normal pagination ────────────────────────────────────────────────────
    const hasMore = docs.length > pageSize;
    if (hasMore) docs.pop(); // remove the sentinel

    return NextResponse.json({
      success: true,
      data: {
        users: docs,
        pagination: { page, pageSize, hasMore },
      },
    });
  } catch (e: unknown) {
    console.error('[GET /api/internal/users]', e);
    return err('Failed to fetch users', 500);
  }
}

// ─── PUT /api/internal/users ──────────────────────────────────────────────────
//
// Body:
//   userId    string  (required)
//   isActive  boolean (required) — true = activate, false = suspend
//   reason    string  (required)
//
// Side effects:
//   • Updates users/{userId}.isActive
//   • Appends an audit log entry to users/{userId}/auditLog collection
//   • Records the admin UID who performed the action

export async function PUT(req: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(req, PERMISSIONS.USERS_SUSPEND);
  } catch (e) {
    return handleAuthError(e);
  }

  let body: { userId?: string; isActive?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body');
  }

  const { userId, isActive, reason } = body;

  if (!userId)           return err('userId is required');
  if (typeof isActive !== 'boolean') return err('isActive must be a boolean');
  if (!reason?.trim())   return err('reason is required');

  try {
    const userRef = adminDb.collection('users').doc(userId);
    const snap    = await userRef.get();

    if (!snap.exists) return err('User not found', 404);

    const current = snap.data() as UserRecord;

    // No-op guard
    if (current.isActive === isActive) {
      return NextResponse.json({
        success: true,
        data: { message: `User is already ${isActive ? 'active' : 'suspended'}` },
      });
    }

    const action = isActive ? 'account_activated' : 'account_suspended';

    // Batch: update user doc + write audit log in one round-trip
    const batch = adminDb.batch();

    batch.update(userRef, {
      isActive,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const auditRef = userRef.collection('auditLog').doc();
    batch.set(auditRef, {
      action,
      performedBy: ctx.uid,
      reason: reason.trim(),
      previousValue: { isActive: current.isActive },
      newValue:      { isActive },
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      data: {
        userId,
        isActive,
        action,
      },
    });
  } catch (e: unknown) {
    console.error('[PUT /api/internal/users]', e);
    return err('Failed to update user', 500);
  }
}