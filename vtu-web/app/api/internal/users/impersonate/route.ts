// vtu-web/app/api/internal/users/impersonate/route.ts
// AGENTS.md RULES: #6 (server-side permission checks), #9 (audit log)
// Financial ops are BLOCKED server-side when X-Impersonating header is present.
// All impersonation actions are logged with both admin + target user IDs.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  requirePermission,
  handleAuthError,
  PERMISSIONS,
  writeAuditLog,
} from '@/lib/roles/middleware';
import { ok, err, parseIp } from '@/lib/utils/response';
import { SignJWT, jwtVerify } from 'jose';
import type { User } from '@/types';

const IMPERSONATE_SECRET = new TextEncoder().encode(
  process.env.API_JWT_SECRET ?? 'impersonate-fallback-secret'
);
const SESSION_TTL_MINUTES = 15;

// ─── POST — start impersonation ───────────────────────────────────────────────

/**
 * POST /api/internal/users/impersonate
 * Body: { userId: string }
 *
 * Issues a short-lived (15 min) impersonation token.
 * Requires admin:impersonate permission.
 * Financial routes (withdrawal, debit, transfer) check X-Impersonating header
 * and reject the request server-side.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ADMIN_IMPERSONATE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const targetUserId: string | undefined = body?.userId;

  if (!targetUserId?.trim()) {
    return err('userId is required', 422);
  }

  // Cannot impersonate yourself
  if (targetUserId === ctx.uid) {
    return err('You cannot impersonate yourself.', 400);
  }

  // Load target user
  const targetSnap = await adminDb.collection('users').doc(targetUserId).get();
  if (!targetSnap.exists) return err('Target user not found', 404);
  const targetUser = targetSnap.data() as User;

  // Cannot impersonate another admin
  const targetRoleSnap = await adminDb.collection('roles').doc(targetUser.roleId).get();
  const targetRole = targetRoleSnap.data() as { permissions: string[] } | undefined;
  if (targetRole?.permissions?.includes(PERMISSIONS.ADMIN_IMPERSONATE)) {
    return err('You cannot impersonate another admin with impersonation privileges.', 403);
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  // Issue a signed impersonation token
  const token = await new SignJWT({
    adminId: ctx.uid,
    targetUserId,
    purpose: 'impersonation',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_MINUTES}m`)
    .sign(IMPERSONATE_SECRET);

  // Store in Firestore for server-side lookup and audit
  const sessionRef = adminDb.collection('impersonation_sessions').doc();
  await sessionRef.set({
    id: sessionRef.id,
    adminId: ctx.uid,
    targetUserId,
    token,
    expiresAt: Timestamp.fromDate(expiresAt),
    endedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'impersonation:start',
    resource: 'users',
    targetId: targetUserId,
    before: null,
    after: { sessionId: sessionRef.id, expiresAt },
    ip: parseIp(request),
  });

  return ok(
    {
      token,
      expiresAt: expiresAt.toISOString(),
      sessionId: sessionRef.id,
      targetUser: {
        uid: targetUser.uid,
        displayName: targetUser.displayName,
        email: targetUser.email,
        roleId: targetUser.roleId,
      },
    },
    'Impersonation session started.'
  );
}

// ─── DELETE — end impersonation ───────────────────────────────────────────────

/**
 * DELETE /api/internal/users/impersonate
 * Body: { token: string }
 *
 * Revokes the impersonation session.
 */
export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ADMIN_IMPERSONATE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const token: string | undefined = body?.token;

  if (!token) return err('token is required', 422);

  // Verify token
  let payload: { adminId: string; targetUserId: string } | undefined = undefined;
  try {
    const { payload: p } = await jwtVerify(token, IMPERSONATE_SECRET);
    payload = p as typeof payload;
  } catch {
    // Token expired or invalid — still clean up by looking for matching session
  }

  const targetUserId = payload?.targetUserId;

  // Find and end the session
  const sessionSnap = await adminDb
    .collection('impersonation_sessions')
    .where('adminId', '==', ctx.uid)
    .where('token', '==', token)
    .limit(1)
    .get();

  if (!sessionSnap.empty) {
    await sessionSnap.docs[0].ref.update({
      endedAt: Timestamp.now(),
    });
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'impersonation:end',
    resource: 'users',
    targetId: targetUserId ?? 'unknown',
    ip: parseIp(request),
  });

  return ok(null, 'Impersonation session ended.');
}

// ─── GET — validate a token (used by server components) ──────────────────────

/**
 * GET /api/internal/users/impersonate?token=xxx
 * Validates whether an impersonation token is still active.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return err('token query param is required', 422);

  try {
    const { payload } = await jwtVerify(token, IMPERSONATE_SECRET);
    const p = payload as { adminId: string; targetUserId: string; purpose: string };

    if (p.purpose !== 'impersonation') return err('Invalid token purpose', 400);

    const targetSnap = await adminDb.collection('users').doc(p.targetUserId).get();
    if (!targetSnap.exists) return err('Target user not found', 404);

    const targetUser = targetSnap.data() as User;

    return ok({
      valid: true,
      adminId: p.adminId,
      targetUser: {
        uid: targetUser.uid,
        displayName: targetUser.displayName,
        email: targetUser.email,
        roleId: targetUser.roleId,
      },
      expiresAt: new Date((payload.exp ?? 0) * 1000).toISOString(),
    });
  } catch {
    return ok({ valid: false });
  }
}