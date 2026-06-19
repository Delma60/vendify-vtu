// vtu-web/app/api/internal/campaign-events/route.ts
// AGENTS.md RULES: #4 (zod), #6 (permission), #8 (archive not delete), #9 (audit)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { createCampaignEvent, listCampaignEvents } from '@/lib/events/engine';
import { ok, err, parseIp } from '@/lib/utils/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const RewardSchema = z.object({
  type: z.enum(['wallet_credit', 'loyalty_points', 'badge']),
  walletCreditKobo: z.number().int().positive().optional(),
  loyaltyPoints: z.number().int().positive().optional(),
  badgeId: z.string().min(1).optional(),
  badgeLabel: z.string().min(1).optional(),
}).refine(
  r => (r.type === 'wallet_credit' ? !!r.walletCreditKobo : true),
  { message: 'walletCreditKobo is required for wallet_credit rewards', path: ['walletCreditKobo'] }
).refine(
  r => (r.type === 'loyalty_points' ? !!r.loyaltyPoints : true),
  { message: 'loyaltyPoints is required for loyalty_points rewards', path: ['loyaltyPoints'] }
).refine(
  r => (r.type === 'badge' ? !!r.badgeId : true),
  { message: 'badgeId is required for badge rewards', path: ['badgeId'] }
);

const SegmentSchema = z.enum([
  'all', 'new_users', 'kyc_tier_1', 'kyc_tier_2',
  'plan_starter', 'plan_pro', 'plan_enterprise',
]);

const CreateCampaignEventSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  rewards: z.array(RewardSchema).min(1, 'At least one reward is required'),
  userSegment: SegmentSchema.default('all'),
  maxClaimsPerUser: z.number().int().min(0).default(1),
  maxTotalClaims: z.number().int().min(0).default(0),
  totalBudgetKobo: z.number().int().min(0).default(0),
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
}).refine(
  d => new Date(d.endDate) > new Date(d.startDate),
  { message: 'endDate must be after startDate', path: ['endDate'] }
);

const ListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
  activeOnly: z.coerce.boolean().default(false),
});

// ─── GET — list campaign events ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.EVENTS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const events = await listCampaignEvents(parsed.data);
  return ok({ events, count: events.length });
}

// ─── POST — create a campaign event ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.EVENTS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateCampaignEventSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const d = parsed.data;
  let event;
  try {
    event = await createCampaignEvent(
      {
        name: d.name,
        description: d.description,
        rewards: d.rewards,
        userSegment: d.userSegment,
        maxClaimsPerUser: d.maxClaimsPerUser,
        maxTotalClaims: d.maxTotalClaims,
        totalBudgetKobo: d.totalBudgetKobo,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
      },
      ctx.uid
    );
  } catch (e: any) {
    return err(e.message, 400);
  }

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'campaign_event:create',
    resource: 'campaign_events',
    targetId: event.id,
    before: null,
    after: event,
    ip: parseIp(request),
  });

  return ok(
    { event, shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/e/${event.shareSlug}` },
    `Event "${d.name}" created.`,
    201
  );
}