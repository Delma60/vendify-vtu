// vtu-web/app/api/v1/networks/route.ts

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';

// 1. READ: Get all networks
export async function GET(request: NextRequest) {
  try {
    const snap = await adminDb
      .collection('networks')
      .orderBy('name', 'asc')
      .get();

    const networks = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return ok({ networks, count: networks.length }, 'Networks retrieved successfully');
  } catch (error: any) {
    console.error('Error fetching networks:', error);
    return err('Failed to fetch networks.', 500);
  }
}

// 2. CREATE: Add a new network
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, type, isActive, id } = body;

    // Validation
    if (!code || !name || !type) {
      return err('Missing required fields: code, name, or type.', 400);
    }

    // Check if network code already exists
    const existing = await adminDb
      .collection('networks')
      .where('code', '==', code.toLowerCase().trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return err(`A network with code '${code}' already exists.`, 409);
    }

    const networkData = {
      id: id.toLowerCase().trim(),
      code: code.toLowerCase().trim(),
      name: name.trim(),
      type: type.toLowerCase().trim(), // e.g., 'telecom', 'cable', 'electricity'
      isActive: isActive ?? true,
      createdAt: new Date().toISOString()
    };

    // Use the code as the document ID for cleaner organization
    await adminDb.collection('networks').doc(networkData.code).set(networkData);

    return ok({ network: networkData }, 'Network created successfully', 201);
  } catch (error: any) {
    console.error('Error creating network:', error);
    return err('Failed to create network.', 500);
  }
}