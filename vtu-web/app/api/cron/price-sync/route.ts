// vtu-web/app/api/cron/price-sync/route.ts
// AGENTS.md RULES: #9 (log every external call), #13 (config from Firestore), #14 (runtime config)
//
// Schedule: Every 6 hours (Vercel Cron: "0 */6 * * *")
//
// vercel.json:
//   { "path": "/api/cron/price-sync", "schedule": "0 */6 * * *" }

import { NextRequest, NextResponse } from 'next/server';
import { syncPricesFromProviders } from '@/lib/providers/prices';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const summary = await syncPricesFromProviders({ adminId: 'cron' });

    console.log('[cron:price-sync]', summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[cron:price-sync]', error);
    return NextResponse.json(
      { success: false, error: 'Price sync failed' },
      { status: 500 }
    );
  }
}