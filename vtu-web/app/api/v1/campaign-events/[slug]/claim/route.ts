// vtu-web/app/api/v1/campaign-events/[slug]/claim/route.ts
// AGENTS.md RULES: #5 (idempotency), #9 (log)

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { claimCampaignEvent } from '@/lib/events/engine';
import { ok, err, parseIp } from '@/lib/utils/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session) return err('Please log in to claim this reward.', 401);

  const { slug } = await params;

  const result = await claimCampaignEvent(
    { shareSlug: slug },
    session.uid,
    { source: 'link', ip: parseIp(request) }
  );

  if (!result.claimed) {
    const status = result.reason === 'Event not found' ? 404 : 400;
    return err(result.reason ?? 'Unable to claim this event.', status, result.alreadyClaimed ? 'ALREADY_CLAIMED' : undefined);
  }

  return ok({ rewardsGiven: result.rewardsGiven }, 'Reward claimed!');
}