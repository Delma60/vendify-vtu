// vtu-web/app/api/v1/networks/type/route.ts

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch all networks, ordered alphabetically
    const snap = await adminDb
      .collection('network_types')
      .orderBy('name', 'asc')
      .get();

    // Initialize an object to hold our grouped arrays
    const groupedNetworks: Record<string, { id: string; name: string; isActive: boolean }[]> = {};
    let totalCount = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const type = data.type ? data.type.toLowerCase() : 'uncategorized';

      // Create the array for this type if it doesn't exist yet
      if (!groupedNetworks[type]) {
        groupedNetworks[type] = [];
      }

      // Push the lightweight object to the specific type's array
      groupedNetworks[type].push({
        id: doc.id,
        name: data.name,
        isActive: data.isActive ?? false,
      });

      totalCount++;
    });

    return ok(
      { 
        grouped: groupedNetworks, 
        availableTypes: Object.keys(groupedNetworks),
        totalCount 
      },
      'All network types retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error fetching grouped network types:', error);
    return err('Failed to fetch network types.', 500);
  }
}