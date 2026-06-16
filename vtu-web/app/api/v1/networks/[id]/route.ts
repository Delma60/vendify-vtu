// vtu-web/app/api/v1/networks/[id]/route.ts

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';

interface RouteParams {
  params: { id: string };
}

// 3. READ: Get a single network by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const docRef = adminDb.collection('networks').doc(params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return err('Network not found.', 404);
    }

    return ok({ id: doc.id, ...doc.data() }, 'Network retrieved successfully');
  } catch (error: any) {
    console.error('Error fetching single network:', error);
    return err('Failed to fetch network.', 500);
  }
}

// 4. UPDATE: Modify a network's properties
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const docRef = adminDb.collection('networks').doc(params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return err('Network not found.', 404);
    }

    const body = await request.json();
    
    // Construct updates while keeping timestamps tidy
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (body.name) updates.name = body.name.trim();
    if (body.type) updates.type = body.type.toLowerCase().trim();
    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;

    await docRef.update(updates);

    return ok({ id: params.id, ...updates }, 'Network updated successfully');
  } catch (error: any) {
    console.error('Error updating network:', error);
    return err('Failed to update network.', 500);
  }
}

// 5. DELETE: Remove a network entirely
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const docRef = adminDb.collection('networks').doc(params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return err('Network not found.', 404);
    }

    await docRef.delete();

    return ok({ id: params.id }, 'Network deleted successfully');
  } catch (error: any) {
    console.error('Error deleting network:', error);
    return err('Failed to delete network.', 500);
  }
}