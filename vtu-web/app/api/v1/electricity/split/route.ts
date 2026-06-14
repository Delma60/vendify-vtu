// vtu-web/app/api/v1/electricity/split/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import {
  DISCOS,
  createBillSplit,
  listBillSplits,
  verifyMeter,
  normaliseMeterNumber,
} from '@/lib/electricity/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateSplitSchema = z.object({
  partnerIdentifier: z.string().min(1, 'Partner email, phone, or referral code is required'),
  meterNumber: z.string().min(6).max(20),
  disco: z.enum(DISCOS, {
    errorMap: () => ({ message: `disco must be one of: ${DISCOS.join(', ')}` }),
  }),
  meterType: z.enum(['prepaid', 'postpaid']),
  totalAmount: z
    .number()
    .int('Amount must be in kobo (integer)')
    .min(1000_00, 'Minimum split amount is ₦1,000'),
  // initiator's share — must be strictly between 0 and totalAmount
  initiatorShare: z.number().int('Share must be in kobo (integer)').positive(),
});

// ─── GET /api/v1/electricity/split — list this user's splits ─────────────────

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const splits = await listBillSplits(session.uid);
  return ok({ splits });
}

// ─── POST /api/v1/electricity/split — create a bill split request ────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = CreateSplitSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { partnerIdentifier, meterNumber, disco, meterType, totalAmount, initiatorShare } = parsed.data;
  const normalisedMeter = normaliseMeterNumber(meterNumber);

  if (!/^\d{6,20}$/.test(normalisedMeter)) {
    return err('Meter number must contain only digits.', 422);
  }

  if (initiatorShare >= totalAmount) {
    return err('Your share must be less than the total bill amount.', 422);
  }

  // Verify the meter so we can capture and display the customer name
  let customerName: string;
  try {
    const meterInfo = await verifyMeter(normalisedMeter, disco, meterType);
    customerName = meterInfo.customerName;
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this meter. Please check the meter number and try again.',
      400,
      'METER_VERIFICATION_FAILED'
    );
  }

  try {
    const { splitId, partnerShareKobo } = await createBillSplit(session.uid, {
      partnerIdentifier,
      disco,
      meterNumber: normalisedMeter,
      meterType,
      customerName,
      totalAmountKobo: totalAmount,
      initiatorShareKobo: initiatorShare,
    });

    return ok(
      {
        splitId,
        customerName,
        totalAmountKobo: totalAmount,
        initiatorShareKobo: initiatorShare,
        partnerShareKobo,
      },
      'Bill split request sent. Your partner has been notified.',
      201
    );
  } catch (e: any) {
    return err(e.message, 400);
  }
}