// vtu-web/app/api/v1/airtime/a2c/route.ts
// AGENTS.md RULES: #1 (kobo), #4 (zod), #13 (config from Firestore)
// Airtime-to-Cash: user submits a request, admin reviews, wallet is credited on approval.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import {
  createA2CRequest,
  getA2CRate,
  NIGERIAN_NETWORKS,
  normalisePhone,
} from '@/lib/airtime/engine';
import type { User } from '@/types';

// ─── Validation ───────────────────────────────────────────────────────────────

const SubmitA2CSchema = z.object({
  network: z.enum(NIGERIAN_NETWORKS),
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  // face value in NAIRA from user input
  faceValueNaira: z
    .number()
    .min(100, 'Minimum airtime-to-cash is ₦100')
    .max(500_000, 'Maximum airtime-to-cash is ₦500,000'),
});

const ListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'credited']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── GET /api/v1/airtime/a2c — list user's requests + current rates ──────────

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { status, page, pageSize } = parsed.data;

  // Load rates for all networks (for the UI to display)
  const rateSnap = await adminDb.collection('airtime_to_cash_rates').get();
  const rates = rateSnap.docs
    .map((d) => d.data())
    .filter((r) => r.isActive)
    .map((r) => ({
      network: r.network,
      ratePercent: r.ratePercent,
      minAmountNaira: r.minAmountKobo / 100,
      maxAmountNaira: r.maxAmountKobo > 0 ? r.maxAmountKobo / 100 : null,
    }));

  // Load user's request history
  let query = adminDb
    .collection('airtime_to_cash_requests')
    .where('userId', '==', session.uid)
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (status) query = query.where('status', '==', status);

  const snap = await query.limit(pageSize + 1).offset((page - 1) * pageSize).get();
  const hasMore = snap.docs.length > pageSize;
  const requests = snap.docs.slice(0, pageSize).map((d) => ({ id: d.id, ...d.data() }));

  return ok({ requests, rates, pagination: { page, pageSize, hasMore } });
}

// ─── POST /api/v1/airtime/a2c — submit a new request ─────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = SubmitA2CSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { network, phone, faceValueNaira } = parsed.data;

  // Load user
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;
  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  // Check rate exists for this network
  const rate = await getA2CRate(network);
  if (!rate) {
    return err(
      `Airtime-to-cash is currently not available for ${network.toUpperCase()}. Check back soon.`,
      400,
      'SERVICE_UNAVAILABLE'
    );
  }

  // Limit pending requests to 3 at a time (anti-abuse)
  const pendingSnap = await adminDb
    .collection('airtime_to_cash_requests')
    .where('userId', '==', session.uid)
    .where('status', '==', 'pending')
    .get();

  if (pendingSnap.size >= 3) {
    return err(
      'You already have 3 pending airtime-to-cash requests. Please wait for them to be processed.',
      429,
      'TOO_MANY_PENDING'
    );
  }

  const faceValueKobo = Math.round(faceValueNaira * 100);

  try {
    const result = await createA2CRequest(session.uid, {
      network,
      phone: normalisePhone(phone),
      faceValueKobo,
    });

    return ok(
      {
        requestId: result.requestId,
        network,
        phone: normalisePhone(phone),
        faceValueKobo,
        payoutKobo: result.payoutKobo,
        payoutNaira: result.payoutKobo / 100,
        ratePercent: result.ratePercent,
        status: 'pending',
        message:
          'Your request has been submitted. An admin will review and credit your wallet within 24 hours.',
      },
      'Airtime-to-cash request submitted.',
      201
    );
  } catch (e: any) {
    return err(e.message, 400);
  }
}