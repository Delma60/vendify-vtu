// vtu-web/app/api/v1/transactions/route.ts
// AGENTS.md RULES: #4 (zod), #5 (idempotency), #9 (log every external call)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { queryTransactions } from '@/lib/wallet/operations';
import { ok, err } from '@/lib/utils/response';

const TransactionsQuerySchema = z.object({
  category: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed', 'reversed', 'disputed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = TransactionsQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return err((parsed.error as any).errors[0].message, 422);
  }

  const { category, status, startDate, endDate, page, pageSize } = parsed.data;

  const result = await queryTransactions({
    userId: session.uid,
    category,
    status,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page,
    pageSize,
  });

  return ok({
    transactions: result.transactions,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    },
  });
}