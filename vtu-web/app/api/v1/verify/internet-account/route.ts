// vtu-web/app/api/v1/verify/internet-account/route.ts
// AGENTS.md RULES: #4 (zod), #14 (runtime config)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { ok, err } from '@/lib/utils/response';
import {
  verifyInternetAccount,
  normaliseAccountNumber,
  INTERNET_PROVIDERS,
} from '@/lib/internet/engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const VerifyAccountSchema = z.object({
  accountNumber: z
    .string()
    .min(5, 'Account number is too short')
    .max(20, 'Account number is too long'),
  provider: z.enum(INTERNET_PROVIDERS, {
    errorMap: () => ({ message: `provider must be one of: ${INTERNET_PROVIDERS.join(', ')}` }),
  }),
});

// ─── POST /api/v1/verify/internet-account ─────────────────────────────────────

/**
 * Verify a Smile/Spectranet account number with the provider before allowing
 * payment. Returns the customer name and current plan (if any) so the user
 * can confirm before paying.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = VerifyAccountSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { accountNumber, provider } = parsed.data;
  const normalised = normaliseAccountNumber(accountNumber);

  if (!/^[A-Za-z0-9]{5,20}$/.test(normalised)) {
    return err('Account number must be alphanumeric.', 422);
  }

  try {
    const result = await verifyInternetAccount(normalised, provider);

    return ok({
      accountNumber: result.accountNumber,
      provider: result.provider,
      customerName: result.customerName,
      status: result.status,
      currentPlanName: result.currentPlanName,
      expiryDate: result.expiryDate,
    });
  } catch (error: any) {
    return err(
      error?.message ?? 'Could not verify this account number. Please check it and try again.',
      400,
      'ACCOUNT_VERIFICATION_FAILED'
    );
  }
}