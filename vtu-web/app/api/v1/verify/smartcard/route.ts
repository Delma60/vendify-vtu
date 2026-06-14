// vtu-web/app/api/v1/verify/smartcard/route.ts
// AGENTS.md RULES: #4 (zod), #14 (runtime config)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import { verifySmartCard, normaliseSmartCardNumber, CABLE_PROVIDERS } from '@/lib/cable/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const VerifySmartCardSchema = z.object({
  smartCardNumber: z
    .string()
    .min(5, 'Smart card / IUC number is too short')
    .max(20, 'Smart card / IUC number is too long'),
  provider: z.enum(CABLE_PROVIDERS, {
    errorMap: () => ({ message: `provider must be one of: ${CABLE_PROVIDERS.join(', ')}` }),
  }),
});

// ─── POST /api/v1/verify/smartcard ────────────────────────────────────────────

/**
 * Verify a smart card / IUC number with the provider before allowing payment.
 * Returns the customer name and current bouquet (if any) so the user can
 * confirm before paying, and so the UI can pre-select their current bouquet
 * for renewals.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = VerifySmartCardSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { smartCardNumber, provider } = parsed.data;
  const normalised = normaliseSmartCardNumber(smartCardNumber);

  if (!/^\d{5,20}$/.test(normalised)) {
    return err('Smart card / IUC number must contain only digits.', 422);
  }

  try {
    const result = await verifySmartCard(normalised, provider);

    return ok({
      cardNumber: result.cardNumber,
      provider: result.provider,
      customerName: result.customerName,
      status: result.status,
      currentBouquetCode: result.currentBouquetCode,
      currentBouquetName: result.currentBouquetName,
      dueDate: result.dueDate,
      renewalAmountKobo: result.renewalAmountKobo,
    });
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this smart card. Please check the number and try again.',
      400,
      'SMARTCARD_VERIFICATION_FAILED'
    );
  }
}