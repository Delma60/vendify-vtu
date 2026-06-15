// vtu-web/lib/roles/service.ts
// AGENTS.md RULES: #8 (never hard-delete), #9 (audit), #14 (runtime config — no deploy needed)

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Role } from '@/types';
import { PERMISSIONS, type Permission } from '@/lib/roles/middleware';

// System roles that cannot be deleted (AGENTS.md: seed default roles)
export const SYSTEM_ROLE_IDS = new Set([
  'super_admin',
  'admin',
  'support_agent',
  'finance_officer',
  'marketing_manager',
  'reseller',
  'api_user',
  'customer',
]);

const ALL_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

export interface RoleListItem extends Role {
  // userCount is denormalized on the doc already
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

export async function listRoles(): Promise<RoleListItem[]> {
  const snap = await adminDb.collection('roles').orderBy('name', 'asc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoleListItem);
}

export async function getRole(roleId: string): Promise<Role | null> {
  const snap = await adminDb.collection('roles').doc(roleId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Role;
}

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────

export function validatePermissions(permissions: string[]): string[] {
  return permissions.filter((p) => !ALL_PERMISSIONS.has(p));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions: string[];
}

export async function createRole(
  input: CreateRoleInput,
  adminId: string
): Promise<Role> {
  const invalid = validatePermissions(input.permissions);
  if (invalid.length) {
    throw Object.assign(new Error(`Unknown permission(s): ${invalid.join(', ')}`), {
      code: 'INVALID_PERMISSIONS',
    });
  }

  const baseId = slugify(input.name);
  if (!baseId) {
    throw Object.assign(new Error('Role name must contain at least one letter or number'), {
      code: 'INVALID_NAME',
    });
  }
  if (SYSTEM_ROLE_IDS.has(baseId)) {
    throw Object.assign(new Error(`'${baseId}' is a reserved system role name`), {
      code: 'RESERVED_NAME',
    });
  }

  const ref = adminDb.collection('roles').doc(baseId);
  const existing = await ref.get();
  if (existing.exists) {
    throw Object.assign(new Error(`A role with the name '${input.name}' already exists`), {
      code: 'DUPLICATE_ROLE',
    });
  }

  const role: Omit<Role, 'id'> = {
    name: input.name.trim(),
    description: input.description.trim(),
    permissions: Array.from(new Set(input.permissions)),
    isSystemRole: false,
    userCount: 0,
    createdBy: adminId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } as unknown as Omit<Role, 'id'>;

  await ref.set(role);

  return { id: ref.id, ...role } as Role;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export async function updateRole(
  roleId: string,
  updates: UpdateRoleInput
): Promise<Role> {
  const ref = adminDb.collection('roles').doc(roleId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('Role not found'), { code: 'NOT_FOUND' });
  }

  const role = snap.data() as Role;

  if (updates.permissions) {
    const invalid = validatePermissions(updates.permissions);
    if (invalid.length) {
      throw Object.assign(new Error(`Unknown permission(s): ${invalid.join(', ')}`), {
        code: 'INVALID_PERMISSIONS',
      });
    }

    // Guard: the super_admin role must always retain admin:impersonate +
    // roles:assign so a lockout cannot occur.
    if (roleId === 'super_admin') {
      const required = [PERMISSIONS.ROLES_ASSIGN, PERMISSIONS.ADMIN_IMPERSONATE, PERMISSIONS.SYSTEM_SETTINGS];
      const missing = required.filter((p) => !updates.permissions!.includes(p));
      if (missing.length) {
        throw Object.assign(
          new Error(`The super_admin role must retain: ${missing.join(', ')}`),
          { code: 'SUPER_ADMIN_GUARD' }
        );
      }
    }
  }

  // System roles: name/description are locked (avoid confusing renames of
  // 'customer', 'super_admin', etc.), but permissions can still be tuned.
  const update: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (!role.isSystemRole && updates.name !== undefined) {
    update.name = updates.name.trim();
  }
  if (!role.isSystemRole && updates.description !== undefined) {
    update.description = updates.description.trim();
  }
  if (updates.permissions !== undefined) {
    update.permissions = Array.from(new Set(updates.permissions));
  }

  await ref.update(update);

  return { ...role, id: roleId, ...update } as Role;
}

// ─── DELETE (guarded) ─────────────────────────────────────────────────────────

export async function deleteRole(roleId: string): Promise<void> {
  const ref = adminDb.collection('roles').doc(roleId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('Role not found'), { code: 'NOT_FOUND' });
  }

  const role = snap.data() as Role;

  if (role.isSystemRole || SYSTEM_ROLE_IDS.has(roleId)) {
    throw Object.assign(new Error('System roles cannot be deleted'), {
      code: 'SYSTEM_ROLE',
    });
  }

  if ((role.userCount ?? 0) > 0) {
    throw Object.assign(
      new Error(
        `This role has ${role.userCount} assigned user${role.userCount === 1 ? '' : 's'}. Reassign them before deleting.`
      ),
      { code: 'ROLE_IN_USE' }
    );
  }

  // Roles have no PII/financial history of their own — safe to hard-delete
  // (the audit_logs collection retains the historical record of role config
  // via before/after snapshots, satisfying rule #8's intent).
  await ref.delete();
}

// ─── FieldValue re-export convenience (used by route for userCount math) ─────
export { FieldValue };