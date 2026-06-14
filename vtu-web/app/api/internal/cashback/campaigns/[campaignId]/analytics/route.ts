// vtu-web/app/api/internal/cashback/campaigns/[campaignId]/analytics/route.ts
// AGENTS.md RULES: #6 (permission), #9 (log)

import { NextRequest } from 'next/server';
import { requirePermission, handleAuthError, PERMISSIONS } from '@/lib/roles/middleware';
import { getCampaign, getCampaignAnalytics } from '@/lib/cashback/engine';
import { ok, err } from '@/lib/utils/response';

type RouteContext = { params: { campaignId: string } };

/**
 * GET /api/internal/cashback/campaigns/:campaignId/analytics
 *
 * Returns full analytics for a campaign including ROI estimate,
 * unique users rewarded, budget utilisation, and top-service breakdown.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, PERMISSIONS.MARKETING_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return err('Campaign not found', 404);

  const analytics = await getCampaignAnalytics(params.campaignId);
  return ok({ analytics });
}