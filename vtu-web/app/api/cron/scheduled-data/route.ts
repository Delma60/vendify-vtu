// vtu-web/app/api/cron/scheduled-data/route.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log), #11 (test with emulator)

import { NextRequest, NextResponse } from 'next/server';
import { runScheduledDataRenewals } from '@/lib/data/engine';

/**
 * GET /api/cron/scheduled-data
 *
 * Processes all scheduled data renewal rules that are due.
 * Each rule has a `nextTriggerAt` field; this cron fires any that have passed.
 *
 * Schedule: Every hour (Vercel Cron: "0 * * * *")
 *
 * vercel.json:
 *   { "path": "/api/cron/scheduled-data", "schedule": "0 * * * *" }
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const summary = await runScheduledDataRenewals();
    console.log('[cron:scheduled-data]', summary);
    return NextResponse.json({ success: true, data: { ...summary, runAt: new Date().toISOString() } });
  } catch (error) {
    console.error('[cron:scheduled-data]', error);
    return NextResponse.json({ success: false, error: 'Scheduled data run failed' }, { status: 500 });
  }
}