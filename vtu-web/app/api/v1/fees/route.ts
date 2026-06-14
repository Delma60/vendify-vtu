// vtu-web/app/api/v1/fees/route.ts
// AGENTS.md RULES: #4 (zod), #13 (config from Firestore)
// Public endpoint — authenticated users can query the fee for a service+amount
// before submitting a purchase. Powers the "checkout fee display" requirement.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { calculateFee, listFeeConfigs } from '@/lib/fees/engine';
import { ok, err } from '@/lib/utils/response';

const PreviewSchema = z.object({
  service: z.string().min(1, 'service is required'),
  amount: z
    .coerce.number()
    .int('Amount must be in kobo (integer)')
    .positive('Amount must be positive'),
});

/**
 * GET /api/v1/fees?service=airtime&amount=500000
 *
 * Returns a full fee breakdown for a given service + transaction amount.
 * Used by the checkout UI to display fees before the user confirms a purchase.
 *
 * Also supports GET /api/v1/fees (no query params) to list all active fee configs
 * for building a fee table on the pricing/help pages.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');
  const amountRaw = searchParams.get('amount');

  // If no params → return the full fee schedule
  if (!service && !amountRaw) {
    const configs = await listFeeConfigs(false);

    // Strip internal fields (updatedBy, etc.) for public response
    const publicConfigs = configs.map(c => ({
      service: c.service,
      feeType: c.feeType,
      feeValue: c.feeValue,
      minFeeKobo: c.minFeeKobo,
      maxFeeKobo: c.maxFeeKobo,
      vatEnabled: c.vatEnabled,
      vatRate: c.vatEnabled ? c.vatRate : 0,
    }));

    return ok({ configs: publicConfigs });
  }

  // Validate for the preview calculation
  const parsed = PreviewSchema.safeParse({ service, amount: amountRaw });
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const result = await calculateFee(parsed.data.service, parsed.data.amount);

  return ok({
    service: result.service,
    transactionAmountKobo: result.transactionAmountKobo,
    platformFeeKobo: result.platformFeeKobo,
    vatKobo: result.vatKobo,
    totalFeeKobo: result.totalFeeKobo,
    totalChargeKobo: result.totalChargeKobo,
    breakdown: result.feeBreakdown,
  });
}