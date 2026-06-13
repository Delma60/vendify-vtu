// vtu-web/app/api/cron/spending-limit-reset/route.ts
// AGENTS.md RULES: #2 (wallet ops), #9 (log every external call), #11 (test with emulator)

import { NextRequest, NextResponse } from 'next/server';
import { resetSpendingLimits } from '@/lib/wallet/operations';

export async function GET(request: NextRequest) {
  // Guard: only allow Vercel Cron or internal calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await resetSpendingLimits();

    return NextResponse.json({
      success: true,
      data: { ...result, runAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[cron:spending-limit-reset]', error);
    return NextResponse.json(
      { success: false, error: 'Reset failed' },
      { status: 500 }
    );
  }
}