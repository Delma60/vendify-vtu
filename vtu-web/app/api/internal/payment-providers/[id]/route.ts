import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const UpdateProviderSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  publicKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  feePercentage: z.number().min(0).max(100).optional(),
  feeCap: z.number().min(0).optional(),
});

// PUT: Update an existing provider
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roleId = request.headers.get('x-role-id');
  if (roleId !== 'super_admin' && roleId !== 'admin') {
    return err('Forbidden', 403);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = UpdateProviderSchema.safeParse(body);
    
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const updateData = {
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('payment_providers').doc(params.id).update(updateData);

    return ok(null, 'Payment provider updated successfully');
  } catch (error: any) {
    return err(error.message || 'Failed to update provider', 500);
  }
}

// DELETE: Soft delete a provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roleId = request.headers.get('x-role-id');
  if (roleId !== 'super_admin') {
    return err('Only Super Admins can delete payment providers', 403);
  }

  try {
    // AGENTS.md Rule 8: Soft deletes for critical entities
    await adminDb.collection('payment_providers').doc(params.id).update({
      isDeleted: true,
      isActive: false, // Force deactivation upon deletion
      updatedAt: FieldValue.serverTimestamp(),
    });

    return ok(null, 'Payment provider deleted successfully');
  } catch (error: any) {
    return err(error.message || 'Failed to delete provider', 500);
  }
}