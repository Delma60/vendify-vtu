// vtu-web/app/api/v1/commissions/route.ts
// AGENTS.md RULES: #4 (zod), #13 (config from Firestore)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getCommissionHistory } from '@/lib/commissions/engine';
import { ok, err } from '@/lib/utils/response';

const QuerySchema = z.object({
  status: z.enum(['pending', 'credited', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/v1/commissions
 *
 * Returns the authenticated user's commission history with:
 * - Paginated records
 * - Pending and credited totals
 * - Configured payout threshold
 * - Whether the user can request an early withdrawal
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { status, page, pageSize } = parsed.data;

  const result = await getCommissionHistory({
    userId: session.uid,
    status,
    page,
    pageSize,
  });

  return ok({
    commissions: result.commissions,
    summary: {
      totalPendingKobo: result.totalPending,
      totalCreditedKobo: result.totalCredited,
      payoutThresholdKobo: result.payoutThreshold,
      canWithdraw: result.canWithdraw,
      pendingMeetsThreshold: result.totalPending >= result.payoutThreshold,
    },
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    },
  });
}