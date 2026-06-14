// vtu-web/app/api/v1/airtime/auto-recharge/route.ts
// AGENTS.md RULES: #4 (zod), #8 (never hard-delete), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import {
  upsertAutoRechargeRule,
  listAutoRechargeRules,
  deleteAutoRechargeRule,
  NIGERIAN_NETWORKS,
  normalisePhone,
} from '@/lib/airtime/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const UpsertSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(NIGERIAN_NETWORKS),
  // naira values — converted to kobo below
  triggerBalanceNaira: z
    .number()
    .min(0, 'Trigger balance cannot be negative')
    .max(1_000_000, 'Max trigger balance is ₦1,000,000'),
  rechargeAmountNaira: z
    .number()
    .min(10, 'Minimum auto-recharge amount is ₦10')
    .max(100_000, 'Maximum auto-recharge amount is ₦100,000'),
});

const DeleteSchema = z.object({
  ruleId: z.string().min(1),
});

// ─── GET /api/v1/airtime/auto-recharge — list rules ──────────────────────────

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const rules = await listAutoRechargeRules(session.uid);
  return ok({ rules });
}

// ─── POST /api/v1/airtime/auto-recharge — create or update rule ──────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { phone, network, triggerBalanceNaira, rechargeAmountNaira } = parsed.data;

  try {
    const ruleId = await upsertAutoRechargeRule(session.uid, {
      phone: normalisePhone(phone),
      network,
      triggerBalanceKobo: Math.round(triggerBalanceNaira * 100),
      rechargeAmountKobo: Math.round(rechargeAmountNaira * 100),
    });

    return ok({ ruleId }, 'Auto-recharge rule saved.', 201);
  } catch (e: any) {
    return err(e.message, 400);
  }
}

// ─── DELETE /api/v1/airtime/auto-recharge — remove rule (soft) ───────────────

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  try {
    await deleteAutoRechargeRule(parsed.data.ruleId, session.uid);
    return ok(null, 'Auto-recharge rule removed.');
  } catch (e: any) {
    return err(e.message, 404);
  }
}