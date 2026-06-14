// vtu-web/app/api/cron/subscription-renewal/route.ts
// AGENTS.md RULES: #8 (never hard-delete), #11 (Firebase Emulator ready via Admin SDK)

import { NextRequest, NextResponse } from 'next/server';
import { downgradeExpiredUsers, getRenewalReminderCandidates } from '@/lib/subscriptions/plans';
import { sendSubscriptionExpiredEmail as sendSubscriptionExpiryReminderEmail } from '@/lib/notifications/subcription';

/**
 * GET /api/cron/subscription-renewal
 * Cron trigger evaluating expiries, dispatching notification sequences, and handling downgrades.
 */
export async function GET(request: NextRequest) {
  // Simple cron secret safety enforcement check
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Process active graceful downgrades for completely spent memberships
    const { downgraded } = await downgradeExpiredUsers();

    // 2. Aggregate target groups for renewal warnings (7 days, 3 days, 1 day)
    const intervals: (1 | 3 | 7)[] = [7, 3, 1];
    let remindersDispatched = 0;

    for (const days of intervals) {
      const candidates = await getRenewalReminderCandidates(days);
      
      for (const candidate of candidates) {
        await sendSubscriptionExpiryReminderEmail({
          to: candidate.email,
          displayName: candidate.displayName,
          planName: candidate.planName,
        //   daysUntilExpiry: days,
        //   expiresAt: candidate.expiresAt,
        }).catch(console.error);
        
        remindersDispatched++;
      }
    }

    return NextResponse.json({
      success: true,
      downgradedCount: downgraded,
      remindersSent: remindersDispatched,
    });
  } catch (error: any) {
    console.error('[CRON SUBSCRIPTION ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}