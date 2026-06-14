// vtu-web/app/api/cron/auto-recharge/route.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log every external call), #11 (test with emulator)

import { NextRequest, NextResponse } from 'next/server';
import { runAutoRecharges } from '@/lib/airtime/engine';

/**
 * GET /api/cron/auto-recharge
 *
 * Scans all active auto-recharge rules and fires top-ups for any user
 * whose wallet balance has dropped below their configured trigger threshold.
 *
 * Each rule is throttled to one trigger per 6 hours (enforced inside
 * runAutoRecharges) so this cron can safely run frequently.
 *
 * Schedule: Every 15 minutes (Vercel Cron: "every 15 minutes")
 *
 * vercel.json:
 *   { "path": "/api/cron/auto-recharge", "schedule": "+/15 + + + +" }
 */
export async function GET(request: NextRequest) {
  // Guard: only allow Vercel Cron or internal calls authenticated with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const summary = await runAutoRecharges();

    console.log('[cron:auto-recharge]', summary);

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        runAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[cron:auto-recharge]', error);
    return NextResponse.json(
      { success: false, error: 'Auto-recharge run failed' },
      { status: 500 }
    );
  }
}