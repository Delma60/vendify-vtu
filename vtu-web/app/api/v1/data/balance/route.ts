// vtu-web/app/api/v1/data/balance/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const;

const BalanceQuerySchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(NETWORKS),
});

/**
 * GET /api/v1/data/balance?phone=...&network=...
 *
 * Checks a phone number's data balance via the provider router.
 * Only available on networks/providers that support balance check APIs.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = BalanceQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { phone, network } = parsed.data;

  try {
    const { checkDataBalance } = await import('@/lib/providers/router');

    if (typeof checkDataBalance !== 'function') {
      return err('Data balance check is not supported for this network yet.', 400, 'NOT_SUPPORTED');
    }

    const result = await checkDataBalance({ phone, network });

    if (!result.success) {
      return err(result.error ?? 'Could not retrieve data balance. Please try again.', 400);
    }

    return ok({
      phone,
      network,
      balance: result.data,
    });
  } catch {
    return err('Data balance check is not supported for this network yet.', 400, 'NOT_SUPPORTED');
  }
}