// vtu-web/app/api/v1/networks/type/[type]/route.ts

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { type: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const type = params.type.toLowerCase().trim();

    // Fetch networks from Firestore filtered by type
    const snap = await adminDb
      .collection('network_types')
      .where('type', '==', type)
      .orderBy('name', 'asc') // Keeps them alphabetically sorted
      .get();

    // Map strictly to your requested lightweight format
    const networks = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        isActive: data.isActive ?? false,
      };
    });

    return ok(
      { networks, count: networks.length },
      `Retrieved ${type} networks successfully`
    );
  } catch (error: any) {
    console.error(`Error fetching networks for type [${params.type}]:`, error);
    
    // Firestore requires an index for compound queries (where + orderBy).
    // If you get a 500 error on your first run, check your server console for the Firebase index link!
    return err('Failed to fetch networks by type.', 500);
  }
}