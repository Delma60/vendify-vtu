// vtu-web/app/api/internal/wallet/freeze/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { freezeWallet, unfreezeWallet } from '@/lib/wallet/operations';
import { ok, err } from '@/lib/utils/response';
import { adminDb } from '@/lib/firebase/admin';
import { parseIp } from '@/lib/utils/response';
import type { User } from '@/types';

const FreezeSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['freeze', 'unfreeze']),
  reason: z.string().min(3, 'Please provide a reason').max(500),
});

/**
 * PUT /api/internal/wallet/freeze
 * Freeze or unfreeze a user's wallet. Requires users:suspend permission.
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.USERS_SUSPEND);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = FreezeSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message, 422);

  const { userId, action, reason } = parsed.data;

  // Load target user
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  const before = { isFrozen: user.isFrozen };

  if (action === 'freeze') {
    if (user.isFrozen) return err('Wallet is already frozen', 400);
    await freezeWallet(userId);
  } else {
    if (!user.isFrozen) return err('Wallet is not frozen', 400);
    await unfreezeWallet(userId);
  }

  const after = { isFrozen: action === 'freeze' };

  // Audit log
  await writeAuditLog({
    adminId: ctx.uid,
    action: `wallet:${action}`,
    resource: 'wallet',
    targetId: userId,
    before,
    after,
    ip: parseIp(request),
  });

  // Notify user by email (non-blocking)
  notifyUserWalletStatus(user, action, reason).catch(console.error);

  return ok(
    { userId, isFrozen: after.isFrozen },
    `Wallet ${action === 'freeze' ? 'frozen' : 'unfrozen'} successfully.`
  );
}

async function notifyUserWalletStatus(
  user: User,
  action: 'freeze' | 'unfreeze',
  reason: string
): Promise<void> {
  const { sendMail } = await import('@/lib/mail/client');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VendPro';

  if (action === 'freeze') {
    await sendMail({
      to: user.email,
      subject: `Your ${appName} wallet has been frozen`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Wallet frozen</h2>
          <p>Hi ${user.displayName},</p>
          <p>Your ${appName} wallet has been temporarily frozen. You will not be able
          to make transactions until this restriction is lifted.</p>
          <p style="color:#6b7280;font-size:13px">Reason: ${reason}</p>
          <p>If you believe this is an error, please contact our support team.</p>
        </div>
      `,
      text: `Your ${appName} wallet has been frozen. Reason: ${reason}. Contact support if this is an error.`,
    });
  } else {
    await sendMail({
      to: user.email,
      subject: `Your ${appName} wallet has been unfrozen`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Wallet unfrozen</h2>
          <p>Hi ${user.displayName},</p>
          <p>Your ${appName} wallet restriction has been lifted. You can now make
          transactions again.</p>
        </div>
      `,
      text: `Your ${appName} wallet restriction has been lifted. You can now transact again.`,
    });
  }
}