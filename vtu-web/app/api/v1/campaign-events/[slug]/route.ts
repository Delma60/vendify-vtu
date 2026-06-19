// vtu-web/app/api/v1/campaign-events/[slug]/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log)
// Public preview for a shared event link — no auth required to view it.

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getCampaignEventBySlug } from '@/lib/events/engine';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getCampaignEventBySlug(slug);

  if (!event || event.isArchived) return err('This event link is invalid.', 404);

  const now = Date.now();
  const isLive = event.isActive
    && now >= event.startDate.toMillis()
    && now <= event.endDate.toMillis();

  const budgetExhausted = event.totalBudgetKobo > 0 && event.totalPaidKobo >= event.totalBudgetKobo;
  const claimsExhausted = event.maxTotalClaims > 0 && event.totalClaimedCount >= event.maxTotalClaims;

  let alreadyClaimed = false;
  const session = await getSession();
  if (session && event.maxClaimsPerUser > 0) {
    const claimSnap = await adminDb
      .collection('campaign_event_claims')
      .where('eventDefId', '==', event.id)
      .where('userId', '==', session.uid)
      .get();
    alreadyClaimed = claimSnap.size >= event.maxClaimsPerUser;
  }

  return ok({
    name: event.name,
    description: event.description,
    rewards: event.rewards.map(r => ({
      type: r.type,
      ...(r.type === 'wallet_credit' ? { walletCreditKobo: r.walletCreditKobo } : {}),
      ...(r.type === 'loyalty_points' ? { loyaltyPoints: r.loyaltyPoints } : {}),
      ...(r.type === 'badge' ? { badgeLabel: r.badgeLabel ?? r.badgeId } : {}),
    })),
    endDate: event.endDate.toDate().toISOString(),
    isClaimable: isLive && !budgetExhausted && !claimsExhausted,
    isLoggedIn: !!session,
    alreadyClaimed,
  });
}