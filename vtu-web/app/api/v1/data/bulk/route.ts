// vtu-web/app/api/v1/data/bulk/route.ts
// AGENTS.md RULES: #1 (kobo), #2 (wallet ops), #4 (zod), #5 (idempotency), #7 (fraud score), #9 (log)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { getWalletBalance } from '@/lib/wallet/operations';
import { createBulkDataJob, getBulkDataJob, processBulkDataRow } from '@/lib/data/engine';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const;

const BulkRowSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
  network: z.enum(NETWORKS),
  planId: z.string().min(1, 'Plan ID is required'),
});

const CreateBulkJobSchema = z.object({
  rows: z
    .array(BulkRowSchema)
    .min(1, 'At least one row required')
    .max(500, 'Maximum 500 rows per upload'),
  transactionPin: z.string().length(4, 'Transaction PIN must be 4 digits'),
});

const GetJobSchema = z.object({
  jobId: z.string().min(1),
});

/** POST /api/v1/data/bulk — create a bulk data job */
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
  if (!user.transactionPin) return err('Please set a transaction PIN before purchasing.', 400, 'NO_PIN');

  const pinValid = await bcrypt.compare(transactionPin, user.transactionPin);
  if (!pinValid) return err('Incorrect transaction PIN.', 401, 'INVALID_PIN');

  // Build job (resolves plans and validates)
  let jobId: string;
  try {
    jobId = await createBulkDataJob(session.uid, rows);
  } catch (e: any) {
    return err(e.message, 400);
  }

  // Kick off async processing
  processBulkJobAsync(jobId, rows.length).catch(console.error);

  return ok(
    { jobId, rowCount: rows.length },
    `Bulk data job created. Processing ${rows.length} row${rows.length !== 1 ? 's' : ''}.`,
    201
  );
}

/** GET /api/v1/data/bulk?jobId=xxx — poll job status */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const parsed = GetJobSchema.safeParse({ jobId: searchParams.get('jobId') });
  if (!parsed.success) return err('jobId query param is required', 422);

  const job = await getBulkDataJob(parsed.data.jobId, session.uid);
  if (!job) return err('Job not found', 404);

  return ok({ job });
}

// ─── Background processor ─────────────────────────────────────────────────────

async function processBulkJobAsync(jobId: string, totalRows: number): Promise<void> {
  const { adminDb } = await import('@/lib/firebase/admin');
  const { Timestamp } = await import('firebase-admin/firestore');

  await adminDb.collection('bulk_data_jobs').doc(jobId).update({
    status: 'processing',
    updatedAt: Timestamp.now(),
  });

  for (let i = 0; i < totalRows; i++) {
    await processBulkDataRow(jobId, i);
  }
}