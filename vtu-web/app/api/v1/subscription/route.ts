// vtu-web/app/api/v1/subscription/route.ts
// AGENTS.md RULES: #4 (zod), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getActivePlans, getUserSubscriptionStatus } from '@/lib/subscriptions/plans';
import { ok, err } from '@/lib/utils/response';

/**
 * GET /api/v1/subscription
 * Returns the authenticated user's current subscription status and all available plans.
 */
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const [status, plans] = await Promise.all([
    getUserSubscriptionStatus(session.uid),
    getActivePlans(),
  ]);

  return ok({ current: status, plans });
}