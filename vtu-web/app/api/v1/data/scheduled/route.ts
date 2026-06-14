// vtu-web/app/api/v1/data/scheduled/route.ts
// AGENTS.md RULES: #4 (zod), #8 (never hard-delete), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import {
  createScheduledDataRule,
  listScheduledDataRules,
  deleteScheduledDataRule,
} from '@/lib/data/engine';

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const;

const CreateRuleSchema = z
  .object({
    phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
    network: z.enum(NETWORKS),
    planId: z.string().min(1, 'Plan ID is required'),
    renewalDay: z.number().int().min(1).max(28).optional(),
    intervalDays: z.number().int().min(1).max(365).optional(),
  })
  .refine(d => d.renewalDay !== undefined || d.intervalDays !== undefined, {
    message: 'Provide either renewalDay (day of month) or intervalDays',
  });

const DeleteRuleSchema = z.object({
  ruleId: z.string().min(1),
});

/** GET /api/v1/data/scheduled — list active rules */
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const rules = await listScheduledDataRules(session.uid);
  return ok({ rules });
}

/** POST /api/v1/data/scheduled — create a renewal rule */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = CreateRuleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    const ruleId = await createScheduledDataRule(session.uid, parsed.data);
    return ok({ ruleId }, 'Scheduled data renewal created.', 201);
  } catch (e: any) {
    return err(e.message, 400);
  }
}

/** DELETE /api/v1/data/scheduled — remove a rule (soft) */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = DeleteRuleSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    await deleteScheduledDataRule(parsed.data.ruleId, session.uid);
    return ok(null, 'Scheduled renewal removed.');
  } catch (e: any) {
    return err(e.message, 404);
  }
}