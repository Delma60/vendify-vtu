// vtu-web/app/api/internal/roles/assign/route.ts
// Assign or change a user's role. Requires roles:assign permission.
// Super admin is the only role that can assign the super_admin role to others.
// Path: vtu-web/app/api/internal/roles/assign/route.ts

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import {
  requirePermission,
  handleAuthError,
  PERMISSIONS,
  writeAuditLog,
} from '@/lib/roles/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err, parseIp } from '@/lib/utils/response';
import type { User } from '@/types';

const AssignRoleSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  roleId: z.string().min(1, 'roleId is required'),
});

/**
 * POST /api/internal/roles/assign
 *
 * Body: { userId, roleId }
 *
 * Rules enforced here (not just in UI):
 * - Only super_admin can assign the super_admin role to someone else.
 * - Cannot demote yourself out of super_admin (prevents lockout).
 * - Cannot assign a role that does not exist in the roles collection.
 * - System roles cannot be deleted, but any admin with roles:assign can move
 *   users between non-super_admin roles.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ROLES_ASSIGN);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = AssignRoleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { userId, roleId } = parsed.data;

  // ── Validate target role exists ──────────────────────────────────────────
  const roleSnap = await adminDb.collection('roles').doc(roleId).get();
  if (!roleSnap.exists) return err(`Role '${roleId}' does not exist.`, 404);

  // ── Load target user ─────────────────────────────────────────────────────
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return err('User not found.', 404);
  const targetUser = userSnap.data() as User;

  // ── Guard: only super_admin can assign super_admin ───────────────────────
  if (roleId === 'super_admin' && ctx.role.id !== 'super_admin') {
    return err('Only a super_admin can promote another user to super_admin.', 403);
  }

  // ── Guard: cannot demote yourself ────────────────────────────────────────
  if (userId === ctx.uid && targetUser.roleId === 'super_admin' && roleId !== 'super_admin') {
    return err('You cannot demote your own super_admin role.', 400);
  }

  // ── Guard: cannot change the role of another super_admin unless you are one
  if (targetUser.roleId === 'super_admin' && ctx.roleId !== 'super_admin') {
    return err('Only a super_admin can change the role of another super_admin.', 403);
  }

  const previousRoleId = targetUser.roleId;
  if (previousRoleId === roleId) {
    return err(`User is already assigned to role '${roleId}'.`, 400);
  }

  // ── Update user ───────────────────────────────────────────────────────────
  await adminDb.collection('users').doc(userId).update({
    roleId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // ── Keep role.userCount accurate ──────────────────────────────────────────
  const roleBatch = adminDb.batch();

  roleBatch.update(adminDb.collection('roles').doc(roleId), {
    userCount: FieldValue.increment(1),
  });

  if (previousRoleId) {
    roleBatch.update(adminDb.collection('roles').doc(previousRoleId), {
      userCount: FieldValue.increment(-1),
    });
  }

  await roleBatch.commit();

  // ── Audit log ─────────────────────────────────────────────────────────────
  await writeAuditLog({
    adminId: ctx.uid,
    action: 'role:assign',
    resource: 'users',
    targetId: userId,
    before: { roleId: previousRoleId },
    after: { roleId },
    ip: parseIp(request),
  });

  return ok(
    { userId, roleId, previousRoleId },
    `Role updated: ${targetUser.displayName} is now ${roleId}.`
  );
}

/**
 * GET /api/internal/roles/assign?userId=xxx
 * Returns the current role assignment for a user.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ROLES_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) return err('userId query param is required', 422);

  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return err('User not found', 404);

  const user = userSnap.data() as User;
  const roleSnap = await adminDb.collection('roles').doc(user.roleId).get();

  return ok({
    userId,
    roleId: user.roleId,
    roleName: roleSnap.exists ? (roleSnap.data() as { name: string }).name : user.roleId,
    isSystemRole: roleSnap.exists ? (roleSnap.data() as { isSystemRole: boolean }).isSystemRole : false,
  });
}