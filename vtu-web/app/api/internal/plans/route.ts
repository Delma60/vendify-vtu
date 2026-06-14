// vtu-web/app/api/internal/plans/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #6 (Server permission check)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { PERMISSIONS, requirePermission } from '@/lib/roles/middleware';
// import { PERMISSIONS } from '@/lib/roles/permissions';
import { createPlan, updatePlan, getAllPlans } from '@/lib/subscriptions/plans';
import { ok, err } from '@/lib/utils/response';

const PlanFeatureSchema = z.object({
  apiAccess: z.boolean(),
  bucketAccess: z.boolean(),
  loanAccess: z.boolean(),
  whitelabelAccess: z.boolean(),
  maxDailyTransactions: z.number().nullable(),
  rateDiscount: z.number().min(0).max(100),
  prioritySupport: z.boolean(),
  maxApiKeys: z.number().nonnegative(),
});

const CreatePlanSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  monthlyPrice: z.number().int().nonnegative(),
  annualPrice: z.number().int().nonnegative(),
  features: PlanFeatureSchema,
  displayOrder: z.number().int().optional(),
});

const UpdatePlanSchema = CreatePlanSchema.partial().extend({
  id: z.string().min(1),
});

/**
 * GET /api/internal/plans
 * Admin endpoint displaying active and disabled infrastructure models.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);
  
  try {
    await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch {
    return err('Forbidden access.', 403);
  }

  const plans = await getAllPlans();
  return ok({ plans });
}

/**
 * POST /api/internal/plans
 * Generates brand new dynamic customer tier settings.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  try {
    await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch {
    return err('Forbidden access.', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreatePlanSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const planId = await createPlan(parsed.data, session.uid);
  return ok({ planId }, 'Subscription plan established.');
}

/**
 * PATCH /api/internal/plans
 * Updates operational constraints on live tiers.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  try {
    await requirePermission(request, PERMISSIONS.SYSTEM_SETTINGS);
  } catch {
    return err('Forbidden access.', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdatePlanSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { id, ...updates } = parsed.data;
  await updatePlan(id, updates, session.uid);

  return ok(null, 'Subscription parameters modified successfully.');
}