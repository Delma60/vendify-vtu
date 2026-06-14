// vtu-web/app/api/v1/verify/meter/route.ts
// AGENTS.md RULES: #4 (zod), #14 (runtime config)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import { verifyMeter, normaliseMeterNumber, DISCOS } from '@/lib/electricity/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const VerifyMeterSchema = z.object({
  meterNumber: z
    .string()
    .min(6, 'Meter number is too short')
    .max(20, 'Meter number is too long'),
  disco: z.enum(DISCOS, {
    errorMap: () => ({ message: `disco must be one of: ${DISCOS.join(', ')}` }),
  }),
  type: z.enum(['prepaid', 'postpaid'], {
    errorMap: () => ({ message: "type must be 'prepaid' or 'postpaid'" }),
  }),
});

// ─── POST /api/v1/verify/meter ────────────────────────────────────────────────

/**
 * Verify a meter number with the disco/provider before allowing payment.
 * Returns the customer name (and, for postpaid, any outstanding balance)
 * so the user can confirm before paying.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = VerifyMeterSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { meterNumber, disco, type } = parsed.data;
  const normalised = normaliseMeterNumber(meterNumber);

  if (!/^\d{6,20}$/.test(normalised)) {
    return err('Meter number must contain only digits.', 422);
  }

  try {
    const result = await verifyMeter(normalised, disco, type);

    return ok({
      meterNumber: result.meterNumber,
      disco: result.disco,
      type: result.type,
      customerName: result.customerName,
      address: result.address,
      outstandingBalanceKobo: result.outstandingBalanceKobo,
    });
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this meter. Please check the meter number and try again.',
      400,
      'METER_VERIFICATION_FAILED'
    );
  }
}