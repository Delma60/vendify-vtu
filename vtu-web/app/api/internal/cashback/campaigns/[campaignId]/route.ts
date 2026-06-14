// vtu-web/app/api/internal/cashback/campaigns/[campaignId]/route.ts
// AGENTS.md RULES: #4 (zod), #6 (permission), #8 (archive not delete), #9 (audit)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getCampaign, getCampaignAnalytics } from '@/lib/cashback/engine';
import { ok, err, parseIp } from '@/lib/utils/response';

type RouteContext = { params: { campaignId: string } };

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  targetService: z.string().min(1).optional(),
  userSegment: z.enum([
    'all', 'kyc_tier_1', 'kyc_tier_2',
    'plan_starter', 'plan_pro', 'plan_enterprise', 'new_users',
  ]).optional(),
  cashbackType: z.enum(['percentage', 'flat']).optional(),
  cashbackValue: z.number().positive().optional(),
  maxCashbackPerUser: z.number().int().min(0).optional(),
  totalBudgetKobo: z.number().int().min(0).optional(),
  stackingRule: z.enum(['stackable', 'exclusive']).optional(),
  isActive: z.boolean().optional(),
});

// ─── GET — single campaign + analytics ───────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteContext) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.MARKETING_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const withAnalytics = searchParams.get('analytics') === 'true';

  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return err('Campaign not found', 404);

  if (withAnalytics) {
    const analytics = await getCampaignAnalytics(params.campaignId);
    return ok({ campaign, analytics });
  }

  return ok({ campaign });
}

// ─── PATCH — update campaign fields ──────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.MARKETING_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return err('Campaign not found', 404);
  if (campaign.isArchived) return err('Cannot edit an archived campaign.', 400);

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: Timestamp.now() };

  // Convert ISO date strings to Timestamps
  if (updates.startDate) updates.startDate = Timestamp.fromDate(new Date(updates.startDate as string));
  if (updates.endDate) updates.endDate = Timestamp.fromDate(new Date(updates.endDate as string));

  await adminDb.collection('cashback_campaigns').doc(params.campaignId).update(updates);

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'cashback_campaign:update',
    resource: 'cashback_campaigns',
    targetId: params.campaignId,
    before: campaign,
    after: updates,
    ip: parseIp(request),
  });

  return ok({ campaignId: params.campaignId, updated: updates }, 'Campaign updated.');
}

// ─── DELETE — soft-archive only ───────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.MARKETING_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return err('Campaign not found', 404);
  if (campaign.isArchived) return err('Campaign is already archived.', 400);

  await adminDb.collection('cashback_campaigns').doc(params.campaignId).update({
    isArchived: true,
    isActive: false,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'cashback_campaign:archive',
    resource: 'cashback_campaigns',
    targetId: params.campaignId,
    before: campaign,
    after: { isArchived: true, isActive: false },
    ip: parseIp(request),
  });

  return ok({ campaignId: params.campaignId }, `Campaign "${campaign.name}" archived.`);
}