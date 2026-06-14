// vtu-web/app/api/internal/cashback/campaigns/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #8 (never hard-delete), #9 (audit log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { requirePermission, handleAuthError, PERMISSIONS, writeAuditLog } from '@/lib/roles/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { listCampaigns } from '@/lib/cashback/engine';
import { ok, err, parseIp } from '@/lib/utils/response';
import type { CashbackCampaign } from '@/lib/cashback/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const UserSegmentSchema = z.enum([
  'all', 'kyc_tier_1', 'kyc_tier_2',
  'plan_starter', 'plan_pro', 'plan_enterprise',
  'new_users',
]);

const CreateCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).default(''),

  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),

  targetService: z.string().min(1),      // 'airtime' | 'data' | 'electricity' | '*'
  userSegment: UserSegmentSchema,

  cashbackType: z.enum(['percentage', 'flat']),
  cashbackValue: z.number().positive(),  // % or kobo

  // 0 = unlimited
  maxCashbackPerUser: z.number().int().min(0).default(0),
  totalBudgetKobo: z.number().int().min(0).default(0),

  stackingRule: z.enum(['stackable', 'exclusive']).default('stackable'),
}).refine(
  d => new Date(d.endDate) > new Date(d.startDate),
  { message: 'endDate must be after startDate', path: ['endDate'] }
).refine(
  d => !(d.cashbackType === 'percentage' && d.cashbackValue > 100),
  { message: 'Percentage cashback cannot exceed 100%', path: ['cashbackValue'] }
);

const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const ListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
  activeOnly: z.coerce.boolean().default(false),
});

// ─── GET — list all campaigns ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.MARKETING_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const campaigns = await listCampaigns(parsed.data);

  return ok({ campaigns, count: campaigns.length });
}

// ─── POST — create a new campaign ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.MARKETING_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateCampaignSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const d = parsed.data;

  // Guard: reject if a campaign with same name is already active
  const nameCheck = await adminDb
    .collection('cashback_campaigns')
    .where('name', '==', d.name)
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (!nameCheck.empty) {
    return err(`A campaign named "${d.name}" already exists.`, 409);
  }

  const now = Timestamp.now();

  const campaign: Omit<CashbackCampaign, 'id'> = {
    name: d.name,
    description: d.description,
    startDate: Timestamp.fromDate(new Date(d.startDate)),
    endDate: Timestamp.fromDate(new Date(d.endDate)),
    targetService: d.targetService,
    userSegment: d.userSegment,
    cashbackType: d.cashbackType,
    cashbackValue: d.cashbackValue,
    maxCashbackPerUser: d.maxCashbackPerUser,
    totalBudgetKobo: d.totalBudgetKobo,
    stackingRule: d.stackingRule,
    // Counters start at 0
    totalTriggeredCount: 0,
    totalPaidKobo: 0,
    // Admin
    createdBy: ctx.uid,
    isActive: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await adminDb.collection('cashback_campaigns').add(campaign);

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'cashback_campaign:create',
    resource: 'cashback_campaigns',
    targetId: ref.id,
    before: null,
    after: campaign,
    ip: parseIp(request),
  });

  return ok({ campaign: { id: ref.id, ...campaign } }, `Campaign "${d.name}" created.`, 201);
}