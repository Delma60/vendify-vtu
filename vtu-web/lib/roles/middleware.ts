/**
 * Server-side permission guard for admin and internal API routes.
 *
 * Usage:
 *   const { uid } = await requirePermission(request, PERMISSIONS.TRANSACTIONS_REFUND);
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifySessionToken } from '@/lib/auth/session';
import { isSessionRevoked } from '@/lib/auth/device';
import type { Role, User } from '@/types';

// ─── Permission constants ──────────────────────────────────────────────────────

export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_SUSPEND: 'users:suspend',
  USERS_DELETE: 'users:delete',
  USERS_IMPERSONATE: 'users:impersonate',

  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_REFUND: 'transactions:refund',
  TRANSACTIONS_EXPORT: 'transactions:export',

  LOANS_READ: 'loans:read',
  LOANS_APPROVE: 'loans:approve',
  LOANS_REJECT: 'loans:reject',

  KYC_READ: 'kyc:read',
  KYC_APPROVE: 'kyc:approve',
  KYC_REJECT: 'kyc:reject',

  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_DELETE: 'roles:delete',
  ROLES_ASSIGN: 'roles:assign',

  API_KEYS_READ: 'api_keys:read',
  API_KEYS_WRITE: 'api_keys:write',

  COUPONS_READ: 'coupons:read',
  COUPONS_WRITE: 'coupons:write',

  EVENTS_READ: 'events:read',
  EVENTS_WRITE: 'events:write',

  PROVIDERS_READ: 'providers:read',
  PROVIDERS_WRITE: 'providers:write',
  PROVIDERS_FUND: 'providers:fund',

  SUPPORT_READ: 'support:read',
  SUPPORT_HANDLE: 'support:handle',
  SUPPORT_ESCALATE: 'support:escalate',

  FINANCE_READ: 'finance:read',
  FINANCE_WITHDRAW: 'finance:withdraw',
  FINANCE_ADJUST: 'finance:adjust',

  SYSTEM_SETTINGS: 'system:settings',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  SYSTEM_AUDIT: 'system:audit',

  ADMIN_IMPERSONATE: 'admin:impersonate',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  'User Management': [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_IMPERSONATE,
  ],
  Transactions: [
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.TRANSACTIONS_REFUND,
    PERMISSIONS.TRANSACTIONS_EXPORT,
  ],
  Loans: [PERMISSIONS.LOANS_READ, PERMISSIONS.LOANS_APPROVE, PERMISSIONS.LOANS_REJECT],
  KYC: [PERMISSIONS.KYC_READ, PERMISSIONS.KYC_APPROVE, PERMISSIONS.KYC_REJECT],
  'Roles & Access': [
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_WRITE,
    PERMISSIONS.ROLES_DELETE,
    PERMISSIONS.ROLES_ASSIGN,
  ],
  'API Keys': [PERMISSIONS.API_KEYS_READ, PERMISSIONS.API_KEYS_WRITE],
  'Coupons & Events': [
    PERMISSIONS.COUPONS_READ,
    PERMISSIONS.COUPONS_WRITE,
    PERMISSIONS.EVENTS_READ,
    PERMISSIONS.EVENTS_WRITE,
  ],
  Providers: [
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDERS_WRITE,
    PERMISSIONS.PROVIDERS_FUND,
  ],
  Support: [
    PERMISSIONS.SUPPORT_READ,
    PERMISSIONS.SUPPORT_HANDLE,
    PERMISSIONS.SUPPORT_ESCALATE,
  ],
  Finance: [
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_WITHDRAW,
    PERMISSIONS.FINANCE_ADJUST,
  ],
  System: [
    PERMISSIONS.SYSTEM_SETTINGS,
    PERMISSIONS.SYSTEM_MAINTENANCE,
    PERMISSIONS.SYSTEM_AUDIT,
    PERMISSIONS.ADMIN_IMPERSONATE,
  ],
};

// ─── requirePermission ────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

interface PermissionContext {
  uid: string;
  roleId: string;
  user: User;
  role: Role;
}

/**
 * Validates that the current request has the required permission.
 * Throws AuthError (which you should catch and return as a JSON response).
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const { uid } = await requirePermission(request, PERMISSIONS.TRANSACTIONS_REFUND);
 *   // ...
 * }
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<PermissionContext> {
  // 1. Extract token from cookie
  const token = request.cookies.get('vtu_session')?.value;
  if (!token) throw new AuthError('Unauthorized', 401, 'UNAUTHENTICATED');

  // 2. Verify JWT
  const session = await verifySessionToken(token);
  if (!session) throw new AuthError('Invalid or expired session', 401, 'INVALID_TOKEN');

  // 3. Check if session has been revoked (logout / admin suspend)
  const revoked = await isSessionRevoked(session.uid, session.sessionId);
  if (revoked) throw new AuthError('Session has been revoked', 401, 'SESSION_REVOKED');

  // 4. Load user
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) {
    throw new AuthError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  // 5. Load role
  const roleSnap = await adminDb.collection('roles').doc(user.roleId).get();
  if (!roleSnap.exists) throw new AuthError('Role not found', 403, 'ROLE_NOT_FOUND');
  const role = roleSnap.data() as Role;

  // 6. Check permission
  if (!role.permissions.includes(permission)) {
    await writeAuditLog({
      adminId: session.uid,
      action: 'permission_denied',
      resource: permission,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown',
    });
    throw new AuthError(
      `You do not have permission to perform this action (${permission})`,
      403,
      'FORBIDDEN'
    );
  }

  // 7. Log access
  await writeAuditLog({
    adminId: session.uid,
    action: 'permission_granted',
    resource: permission,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown',
  });

  return { uid: session.uid, roleId: user.roleId, user, role };
}

/** Convenience: respond with proper NextResponse on AuthError */
export function handleAuthError(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: e.message, code: e.code },
      { status: e.status }
    );
  }
  console.error('[requirePermission]', e);
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}

// ─── Audit log ────────────────────────────────────────────────────────────────

interface AuditEntry {
  adminId: string;
  action: string;
  resource: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await adminDb.collection('audit_logs').add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[audit_log] Failed to write', e);
  }
}