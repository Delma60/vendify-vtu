// vtu-web/app/api/v1/plans/route.ts
// AGENTS.md RULES: #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { getActivePlans } from '@/lib/subscriptions/plans';
import { ok } from '@/lib/utils/response';

/**
 * GET /api/v1/plans
 * Public endpoint to fetch all active subscription plans for landing & marketing pages.
 */
export async function GET(_request: NextRequest) {
  const plans = await getActivePlans();
  return ok({ plans });
}