// vtu-web/scripts/seed-roles.ts
// Run once to bootstrap system roles and promote the first owner.
//
// Usage:
//   npx tsx scripts/seed-roles.ts
//   SUPER_ADMIN_EMAIL=philip@yourdomain.ng npx ts scripts/seed-roles.ts
//
// Path: vtu-web/scripts/seed-roles.ts

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// ─── Init ─────────────────────────────────────────────────────────────────────

const app = !getApps().length
  ? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  : getApp();

const db = getFirestore(app);

// ─── All permission strings ───────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  'users:read', 'users:write', 'users:suspend', 'users:delete', 'users:impersonate',
  'transactions:read', 'transactions:refund', 'transactions:export',
  'loans:read', 'loans:approve', 'loans:reject',
  'kyc:read', 'kyc:approve', 'kyc:reject',
  'roles:read', 'roles:write', 'roles:delete', 'roles:assign',
  'api_keys:read', 'api_keys:write',
  'coupons:read', 'coupons:write',
  'events:read', 'events:write',
  'providers:read', 'providers:write', 'providers:fund',
  'support:read', 'support:handle', 'support:escalate',
  'finance:read', 'finance:withdraw', 'finance:adjust',
  'system:settings', 'system:maintenance', 'system:audit',
  'admin:impersonate',
  'marketing:read', 'marketing:write',
] as const;

// ─── Role definitions ─────────────────────────────────────────────────────────

interface RoleDef {
  id: string;
  name: string;
  description: string;
  permissions: readonly string[];
  isSystemRole: boolean;
}

const ROLES: RoleDef[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full platform access. Cannot be deleted or modified by other admins.',
    permissions: ALL_PERMISSIONS,
    isSystemRole: true,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'General platform admin with most capabilities except role management and system settings.',
    permissions: [
      'users:read', 'users:write', 'users:suspend',
      'transactions:read', 'transactions:refund', 'transactions:export',
      'loans:read', 'loans:approve', 'loans:reject',
      'kyc:read', 'kyc:approve', 'kyc:reject',
      'roles:read',
      'api_keys:read', 'api_keys:write',
      'coupons:read', 'coupons:write',
      'events:read', 'events:write',
      'providers:read', 'providers:write',
      'support:read', 'support:handle', 'support:escalate',
      'finance:read',
      'marketing:read', 'marketing:write',
    ],
    isSystemRole: true,
  },
  {
    id: 'support_agent',
    name: 'Support Agent',
    description: 'Can handle support tickets, view users and transactions, and process refunds.',
    permissions: [
      'users:read',
      'transactions:read', 'transactions:refund',
      'kyc:read',
      'support:read', 'support:handle',
    ],
    isSystemRole: true,
  },
  {
    id: 'finance_officer',
    name: 'Finance Officer',
    description: 'Can view and export financial data, approve withdrawals, and manage commissions.',
    permissions: [
      'transactions:read', 'transactions:export',
      'finance:read', 'finance:withdraw', 'finance:adjust',
    ],
    isSystemRole: true,
  },
  {
    id: 'marketing_manager',
    name: 'Marketing Manager',
    description: 'Can manage cashback campaigns, coupons, and events.',
    permissions: [
      'marketing:read', 'marketing:write',
      'coupons:read', 'coupons:write',
      'events:read', 'events:write',
    ],
    isSystemRole: false,
  },
  {
    id: 'reseller',
    name: 'Reseller',
    description: 'A business/reseller account with elevated transaction capabilities.',
    permissions: [],
    isSystemRole: true,
  },
  {
    id: 'api_user',
    name: 'API User',
    description: 'Developer account accessing the platform via API keys.',
    permissions: ['api_keys:read', 'api_keys:write'],
    isSystemRole: true,
  },
  {
    id: 'customer',
    name: 'Customer',
    description: 'Standard end-user account.',
    permissions: [],
    isSystemRole: true,
  },
];

// ─── Seed roles ───────────────────────────────────────────────────────────────

async function seedRoles(): Promise<void> {
  console.log('📦 Seeding roles...\n');

  const batch = db.batch();

  for (const role of ROLES) {
    const ref = db.collection('roles').doc(role.id);
    const existing = await ref.get();

    if (existing.exists && existing.data()?.isSystemRole) {
      // Update permissions on system roles but never overwrite manually created fields
      batch.update(ref, {
        permissions: role.permissions,
        description: role.description,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ↻  Updated system role: ${role.id}`);
    } else if (!existing.exists) {
      batch.set(ref, {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystemRole: role.isSystemRole,
        userCount: 0,
        createdBy: 'system',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✓  Created role: ${role.id}`);
    } else {
      console.log(`  –  Skipped (custom role exists): ${role.id}`);
    }
  }

  await batch.commit();
  console.log('\n✅ Roles seeded.\n');
}

// ─── Promote super admin ──────────────────────────────────────────────────────

async function promoteSuperAdmin(email: string): Promise<void> {
  console.log(`🔑 Promoting ${email} to super_admin...\n`);

  const snap = await db
    .collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`  ✗  No user found with email: ${email}`);
    console.error('     Make sure the user has registered first, then re-run this script.\n');
    process.exit(1);
  }

  const userDoc = snap.docs[0];
  const userId = userDoc.id;
  const currentRoleId = userDoc.data().roleId;

  if (currentRoleId === 'super_admin') {
    console.log(`  –  ${email} is already super_admin. Nothing to do.\n`);
    return;
  }

  await db.collection('users').doc(userId).update({
    roleId: 'super_admin',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Keep userCount accurate on both roles
  await db.collection('roles').doc('super_admin').update({
    userCount: FieldValue.increment(1),
  });

  if (currentRoleId) {
    await db
      .collection('roles')
      .doc(currentRoleId)
      .update({ userCount: FieldValue.increment(-1) })
      .catch(() => {}); // role might not exist yet — harmless
  }

  // Audit log
  await db.collection('audit_logs').add({
    adminId: 'system',
    action: 'role:assign',
    resource: 'users',
    targetId: userId,
    before: { roleId: currentRoleId },
    after: { roleId: 'super_admin' },
    ip: 'seed-script',
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`  ✓  ${email} (uid: ${userId}) promoted to super_admin.\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  await seedRoles();

  // Promote via env var or CLI arg
  const target =
    process.env.SUPER_ADMIN_EMAIL ??
    process.argv[2];

  if (target) {
    await promoteSuperAdmin(target.trim());
  } else {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) ?? [];
    if (adminEmails.length > 0) {
      console.log(`ℹ  No SUPER_ADMIN_EMAIL set; promoting ADMIN_EMAILS[0]: ${adminEmails[0]}`);
      await promoteSuperAdmin(adminEmails[0]);
    } else {
      console.log(
        'ℹ  No email provided. To promote an owner, run:\n' +
        '   SUPER_ADMIN_EMAIL=you@domain.com npx tsx scripts/seed-roles.ts\n'
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});