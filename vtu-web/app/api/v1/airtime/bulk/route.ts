// vtu-web/app/api/v1/airtime/bulk/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import {
  createBulkJob,
  getBulkJob,
  detectNetwork,
  normalisePhone,
  NIGERIAN_NETWORKS,
} from '@/lib/airtime/engine';
import { getWalletBalance } from '@/lib/wallet/operations';
import type { User } from '@/types';

// ─── Validation ───────────────────────────────────────────────────────────────

const BulkRowSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(NIGERIAN_NETWORKS).optional(),
  // amount in NAIRA from CSV — converted to kobo internally
  amount: z
    .number()
    .min(10, 'Minimum ₦10 per row')
    .max(100_000, 'Maximum ₦100,000 per row'),
});

const CreateBulkJobSchema = z.object({
  rows: z
    .array(BulkRowSchema)
    .min(1, 'At least one row required')
    .max(1000, 'Maximum 1,000 rows per upload'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
});

const GetJobSchema = z.object({
  jobId: z.string().min(1),
});

// ─── POST /api/v1/airtime/bulk — create a bulk job ───────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const parsed = CreateBulkJobSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { rows, transactionPin } = parsed.data;

  // Load user + verify PIN
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  if (!userSnap.exists) return err('User not found', 404);
  const user = userSnap.data() as User;

  if (!user.isActive || user.isFrozen) return err('Account is restricted.', 403);

  if (!user.transactionPin) {
    return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');
  }

  const bcrypt = await import('bcryptjs');
  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Convert naira → kobo and fill in auto-detected networks
  const processedRows = rows.map((row) => {
    const phone = normalisePhone(row.phone);
    const network = row.network ?? detectNetwork(phone) ?? '';
    const amount = Math.round(row.amount * 100); // naira → kobo
    return { phone, network, amount };
  });

  // Validate all rows have a network
  const missingNetwork = processedRows.filter((r) => !r.network);
  if (missingNetwork.length > 0) {
    return err(
      `Could not detect network for ${missingNetwork.length} number(s): ${missingNetwork
        .slice(0, 3)
        .map((r) => r.phone)
        .join(', ')}. Please include a 'network' column.`,
      422
    );
  }

  // Pre-flight balance check (sum of amounts + rough fee estimate)
  const totalAmountKobo = processedRows.reduce((s, r) => s + r.amount, 0);
  const wallet = await getWalletBalance(session.uid);
  if (!wallet) return err('Wallet not found', 404);

  // Allow 5% buffer for fees
  const estimatedTotal = Math.round(totalAmountKobo * 1.05);
  if (wallet.balance < estimatedTotal) {
    return err(
      `Insufficient wallet balance. Total required (est.): ₦${(estimatedTotal / 100).toFixed(2)}, available: ₦${(wallet.balance / 100).toFixed(2)}`,
      400,
      'INSUFFICIENT_FUNDS'
    );
  }

  // Create the job — processing happens in background cron
  let jobId: string;
  try {
    jobId = await createBulkJob(session.uid, processedRows);
  } catch (e: any) {
    return err(e.message, 400);
  }

  // Kick off async processing (fire-and-forget — cron also handles it)
  processBulkJobAsync(jobId, processedRows.length).catch(console.error);

  return ok(
    { jobId, rowCount: processedRows.length, totalAmountKobo },
    `Bulk job created. Processing ${processedRows.length} rows.`,
    201
  );
}

// ─── GET /api/v1/airtime/bulk?jobId=xxx — poll job status ────────────────────

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = GetJobSchema.safeParse({ jobId: searchParams.get('jobId') });
  if (!parsed.success) return err('jobId query param is required', 422);

  const job = await getBulkJob(parsed.data.jobId, session.uid);
  if (!job) return err('Job not found', 404);

  return ok({ job });
}

// ─── Background processor ─────────────────────────────────────────────────────

async function processBulkJobAsync(jobId: string, totalRows: number): Promise<void> {
  const { processBulkJobRow } = await import('@/lib/airtime/engine');

  // Update status to processing
  const { adminDb } = await import('@/lib/firebase/admin');
  const { Timestamp } = await import('firebase-admin/firestore');
  await adminDb.collection('bulk_airtime_jobs').doc(jobId).update({
    status: 'processing',
    updatedAt: Timestamp.now(),
  });

  // Process rows sequentially to avoid wallet race conditions
  for (let i = 0; i < totalRows; i++) {
    await processBulkJobRow(jobId, i);
  }
}