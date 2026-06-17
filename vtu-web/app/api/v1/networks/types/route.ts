// vtu-web/app/api/v1/networks/type/route.ts
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { createNetworkType, getAllNetworkTypes, updateNetworkType } from '@/lib/db/helpers';
import { NetworkType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    
    const nt = await getAllNetworkTypes()
   
    return ok(nt
      ,
      'All network types retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error fetching grouped network types:', error);
    return err('Failed to fetch network types.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data.name || !data.type) {
      return err('Missing required fields: name or type.', 400);
    }

    await createNetworkType({
      name: data.name.trim(),
      type: data.type.toLowerCase().trim(),
    })
    return ok(null, 'Network type created successfully');
  }catch{
    return err('Failed to create network type.', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data.id || !data.name || !data.type) {
      return err('Missing required fields: id, name or type.', 400);
    }

    await updateNetworkType(data.id, {
      name: data.name.trim(),
      type: data.type.toLowerCase().trim(),
    })
    return ok(null, 'Network type updated successfully');
  }catch{
    return err('Failed to update network type.', 500);
  }
}