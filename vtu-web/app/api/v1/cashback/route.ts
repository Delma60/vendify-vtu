// vtu-web/app/api/v1/cashback/route.ts
// AGENTS.md RULES: #4 (zod), #6 (auth)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import type { CashbackRecord } from '@/lib/cashback/engine';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  campaignId: z.string().optional(),
});

/**
 * GET /api/v1/cashback
 *
 * Returns the authenticated user's cashback history and lifetime totals.
 * Cashback records are distinct from wallet credits — they carry full campaign context.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { page, pageSize, campaignId } = parsed.data;
  const offset = (page - 1) * pageSize;

  let query = adminDb
    .collection('cashback_records')
    .where('userId', '==', session.uid)
    .where('status', '==', 'credited')
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (campaignId) query = query.where('campaignId', '==', campaignId);

  const [pagedSnap, allSnap] = await Promise.all([
    query.limit(pageSize + 1).offset(offset).get(),
    // Total lifetime summary (unfiltered by campaignId)
    adminDb
      .collection('cashback_records')
      .where('userId', '==', session.uid)
      .where('status', '==', 'credited')
      .get(),
  ]);

  const hasMore = pagedSnap.docs.length > pageSize;
  const records = pagedSnap.docs.slice(0, pageSize).map(d => ({
    id: d.id,
    ...d.data(),
  })) as CashbackRecord[];

  const lifetimeTotalKobo = allSnap.docs.reduce(
    (sum, d) => sum + (d.data().cashbackAmountKobo as number),
    0
  );

  return ok({
    records,
    summary: {
      lifetimeTotalKobo,
      recordCount: allSnap.size,
    },
    pagination: {
      page,
      pageSize,
      hasMore,
    },
  });
}