import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const CreateProviderSchema = z.object({
  id: z.string().min(2, 'Provider ID is required (e.g., flutterwave)'),
  name: z.string().min(2, 'Display name is required'),
  isActive: z.boolean().default(false),
});

// GET: Fetch all payment providers
export async function GET(request: NextRequest) {
  // AGENTS.md Rule 6: Server-side permission check via headers passed by middleware
  const roleId = request.headers.get('x-role-id');
  if (roleId !== 'super_admin' && roleId !== 'admin') {
    return err('Forbidden', 403);
  }

  try {
    const snap = await adminDb.collection('payment_providers').where('isDeleted', '!=', true).get();
    const providers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return ok(providers, 'Payment providers fetched successfully');
  } catch (error: any) {
    return err(error.message || 'Failed to fetch providers', 500);
  }
}

// POST: Create a new payment provider
export async function POST(request: NextRequest) {
  const roleId = request.headers.get('x-role-id');
  if (roleId !== 'super_admin') {
    return err('Only Super Admins can create payment providers', 403);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = CreateProviderSchema.safeParse(body);
    
    if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

    const { id, name, isActive } = parsed.data;

    const docRef = adminDb.collection('payment_providers').doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return err('A payment provider with this ID already exists.', 409);
    }

    await docRef.set({
      name,
      isActive,
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
      feePercentage: 0,
      feeCap: 0,
      isDeleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return ok(null, 'Payment provider initialized successfully');
  } catch (error: any) {
    return err(error.message || 'Failed to create provider', 500);
  }
}