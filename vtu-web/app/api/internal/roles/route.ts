// vtu-web/app/api/internal/roles/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #8 (never hard-delete
// for financial/user data — roles are config, see service.ts), #9 (audit), #14 (runtime config)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requirePermission,
  handleAuthError,
  PERMISSIONS,
  writeAuditLog,
  PERMISSION_GROUPS,
} from '@/lib/roles/middleware';
import { ok, err, parseIp } from '@/lib/utils/response';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from '@/lib/roles/service';

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  description: z.string().max(300).default(''),
  permissions: z.array(z.string().min(1)).default([]),
});

const UpdateRoleSchema = z.object({
  roleId: z.string().min(1, 'roleId is required'),
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(300).optional(),
  permissions: z.array(z.string().min(1)).optional(),
});

const DeleteRoleSchema = z.object({
  roleId: z.string().min(1, 'roleId is required'),
});

// ─── GET /api/internal/roles ───────────────────────────────────────────────────
// Returns all roles plus the permission catalogue (grouped) for the admin UI
// checklist. Requires roles:read.

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.ROLES_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const roles = await listRoles();

  return ok({
    roles,
    permissionGroups: PERMISSION_GROUPS,
  });
}

// ─── POST /api/internal/roles — create a new role ─────────────────────────────

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ROLES_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateRoleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    const role = await createRole(parsed.data, ctx.uid);

    await writeAuditLog({
      adminId: ctx.uid,
      action: 'role:create',
      resource: 'roles',
      targetId: role.id,
      before: null,
      after: role,
      ip: parseIp(request),
    });

    return ok({ role }, `Role "${role.name}" created.`, 201);
  } catch (e: unknown) {
    const error = e as { message: string; code?: string };
    const status = error.code === 'DUPLICATE_ROLE' ? 409 : 400;
    return err(error.message, status, error.code);
  }
}

// ─── PUT /api/internal/roles — update permissions / metadata ──────────────────

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ROLES_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { roleId, ...updates } = parsed.data;

  const before = await getRole(roleId);
  if (!before) return err('Role not found', 404);

  // Only a super_admin may edit the super_admin role's permission set
  if (roleId === 'super_admin' && updates.permissions && ctx.roleId !== 'super_admin') {
    return err('Only a super_admin can modify the super_admin role.', 403);
  }

  try {
    const role = await updateRole(roleId, updates);

    await writeAuditLog({
      adminId: ctx.uid,
      action: 'role:update',
      resource: 'roles',
      targetId: roleId,
      before,
      after: role,
      ip: parseIp(request),
    });

    return ok({ role }, `Role "${role.name}" updated.`);
  } catch (e: unknown) {
    const error = e as { message: string; code?: string };
    const status = error.code === 'NOT_FOUND' ? 404 : 400;
    return err(error.message, status, error.code);
  }
}

// ─── DELETE /api/internal/roles — delete a custom role ────────────────────────

export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.ROLES_DELETE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = DeleteRoleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { roleId } = parsed.data;
  const before = await getRole(roleId);
  if (!before) return err('Role not found', 404);

  try {
    await deleteRole(roleId);

    await writeAuditLog({
      adminId: ctx.uid,
      action: 'role:delete',
      resource: 'roles',
      targetId: roleId,
      before,
      after: null,
      ip: parseIp(request),
    });

    return ok({ roleId }, `Role "${before.name}" deleted.`);
  } catch (e: unknown) {
    const error = e as { message: string; code?: string };
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'ROLE_IN_USE' ? 409 : 403;
    return err(error.message, status, error.code);
  }
}