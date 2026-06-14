// vtu-web/app/api/cron/commission-payout/route.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log every external call)

import { NextRequest, NextResponse } from 'next/server';
import { settlePendingCommissions } from '@/lib/commissions/engine';

/**
 * GET /api/cron/commission-payout
 *
 * Settle all pending commission records into earner wallets.
 * Only credits users whose total pending meets the configured payoutThreshold.
 *
 * Schedule: Daily at 06:00 WAT (Vercel Cron: "0 5 * * *")
 *
 * vercel.json:
 *   { "path": "/api/cron/commission-payout", "schedule": "0 5 * * *" }
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const summary = await settlePendingCommissions();

    console.log('[cron:commission-payout]', summary);

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        runAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[cron:commission-payout]', error);
    return NextResponse.json(
      { success: false, error: 'Commission payout failed' },
      { status: 500 }
    );
  }
}