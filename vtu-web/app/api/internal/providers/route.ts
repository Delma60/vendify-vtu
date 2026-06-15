// vtu-web/app/api/internal/providers/route.ts
// AGENTS.md RULES: #4 (zod), #6 (server-side permission checks), #9 (log), #13 (config from Firestore), #14 (runtime config)

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  requirePermission,
  handleAuthError,
  PERMISSIONS,
  writeAuditLog,
} from '@/lib/roles/middleware';
import { ok, err, parseIp } from '@/lib/utils/response';
import { invalidateProviderConfigCache } from '@/lib/providers/config';
import type { ProviderConfig, ServiceType } from '@/types/provider';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_SERVICES: ServiceType[] = ['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'];

const UpdateProviderSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  isActive: z.boolean().optional(),
  priority: z
    .record(z.enum(['airtime', 'data', 'cable', 'electricity', 'exam', 'sms']), z.number().int().min(1).max(99))
    .optional(),
  services: z
    .array(z.enum(['airtime', 'data', 'cable', 'electricity', 'exam', 'sms']))
    .optional(),
  lowFloatThresholdKobo: z.number().int().min(0).optional(),
  autoFundEnabled: z.boolean().optional(),
  autoFundAmountKobo: z.number().int().min(0).optional(),
});

const CreateProviderSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores only'),
  name: z.string().min(2).max(80),
  baseUrl: z.string().url('Base URL must be a valid URL'),
  apiKey: z.string().min(4),
  publicKey: z.string().optional(),
  secretKey: z.string().optional(),
  identifier: z.string().min(2).max(60),
  services: z.array(z.enum(['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'])).min(1),
  priority: z
    .record(z.enum(['airtime', 'data', 'cable', 'electricity', 'exam', 'sms']), z.number().int().min(1).max(99))
    .optional()
    .default({}),
  lowFloatThresholdKobo: z.number().int().min(0).optional().default(5_000_000), // ₦50,000
  autoFundEnabled: z.boolean().optional().default(false),
  autoFundAmountKobo: z.number().int().min(0).optional().default(0),
});

// ─── Helper: fetch live provider balance ──────────────────────────────────────

async function fetchProviderBalance(config: ProviderConfig): Promise<number | null> {
  try {
    const { ProviderFactory } = await import('@/lib/providers/factory');
    const instance = ProviderFactory.make(config);
    return await instance.getBalance();
  } catch {
    return null;
  }
}

async function fetchProviderHealth(config: ProviderConfig): Promise<'healthy' | 'degraded' | 'down'> {
  try {
    const { ProviderFactory } = await import('@/lib/providers/factory');
    const instance = ProviderFactory.make(config);
    const start = Date.now();
    const healthy = await instance.isHealthy();
    const latencyMs = Date.now() - start;
    if (!healthy) return 'down';
    return latencyMs > 3000 ? 'degraded' : 'healthy';
  } catch {
    return 'down';
  }
}

// ─── GET /api/internal/providers ─────────────────────────────────────────────
//
// Returns all configured providers plus optional live health/balance data.
//
// Query params:
//   withHealth=true     — ping each provider for health & balance (slower)
//   service=airtime     — filter to providers supporting a specific service

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const { searchParams } = new URL(request.url);
  const withHealth = searchParams.get('withHealth') === 'true';
  const serviceFilter = searchParams.get('service') as ServiceType | null;

  let query = adminDb.collection('providers').orderBy('name', 'asc') as FirebaseFirestore.Query;
  if (serviceFilter && VALID_SERVICES.includes(serviceFilter)) {
    query = query.where('services', 'array-contains', serviceFilter);
  }

  const snap = await query.get();
  const rawProviders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProviderConfig);

  // Optionally enrich with live health & balance data
  let providers;
  if (withHealth) {
    providers = await Promise.all(
      rawProviders.map(async (p) => {
        const [status, balanceKobo] = await Promise.all([
          fetchProviderHealth(p),
          fetchProviderBalance(p),
        ]);
        return {
          ...p,
          // Mask credentials from the response
          apiKey: `${p.apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, p.apiKey.length - 6))}`,
          secretKey: p.secretKey ? '••••••••' : null,
          liveStatus: status,
          liveBalanceKobo: balanceKobo,
        };
      })
    );
  } else {
    // Return cached float data from Firestore only (no provider ping)
    providers = await Promise.all(
      rawProviders.map(async (p) => {
        const floatSnap = await adminDb.collection('provider_floats').doc(p.id).get();
        const float = floatSnap.exists ? floatSnap.data() : null;
        return {
          ...p,
          apiKey: `${p.apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, p.apiKey.length - 6))}`,
          secretKey: p.secretKey ? '••••••••' : null,
          liveStatus: null,
          cachedBalanceKobo: (float as { balance?: number } | null)?.balance ?? null,
          lowFloatThresholdKobo: (float as { lowThreshold?: number } | null)?.lowThreshold ?? null,
          lastCheckedAt: (float as { lastCheckedAt?: unknown } | null)?.lastCheckedAt ?? null,
        };
      })
    );
  }

  // Build a service routing map: for each service, which provider handles it (by priority)?
  const routingMap: Record<string, { providerId: string; providerName: string; priority: number }[]> = {};
  for (const service of VALID_SERVICES) {
    const serviceProviders = rawProviders
      .filter((p) => p.isActive && p.services.includes(service))
      .sort((a, b) => (a.priority?.[service] ?? 99) - (b.priority?.[service] ?? 99))
      .map((p) => ({
        providerId: p.id,
        providerName: p.name,
        priority: p.priority?.[service] ?? 99,
      }));
    routingMap[service] = serviceProviders;
  }

  return ok({
    providers,
    routingMap,
    totalCount: providers.length,
    activeCount: providers.filter((p) => p.isActive).length,
  });
}

// ─── POST /api/internal/providers — register new provider ────────────────────

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateProviderSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const d = parsed.data;

  // Guard: code must be unique
  const existing = await adminDb.collection('providers').where('code', '==', d.code).limit(1).get();
  if (!existing.empty) {
    return err(`A provider with code '${d.code}' already exists.`, 409);
  }

  const ref = adminDb.collection('providers').doc();
  const now = Timestamp.now();

  const newProvider: Omit<ProviderConfig, 'id'> = {
    code: d.code,
    name: d.name,
    baseUrl: d.baseUrl,
    apiKey: d.apiKey,
    publicKey: d.publicKey ?? '',
    secretKey: d.secretKey ?? '',
    identifier: d.identifier,
    isActive: false, // New providers start inactive — must be explicitly enabled
    services: d.services,
    priority: d.priority ?? {},
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(newProvider);

  // Create float tracking doc
  await adminDb.collection('provider_floats').doc(ref.id).set({
    providerId: ref.id,
    balance: 0,
    lowThreshold: d.lowFloatThresholdKobo,
    autoFundEnabled: d.autoFundEnabled,
    autoFundAmount: d.autoFundAmountKobo,
    lastCheckedAt: now,
    lastFundedAt: null,
    updatedAt: now,
  });

  invalidateProviderConfigCache();

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'provider:create',
    resource: 'providers',
    targetId: ref.id,
    before: null,
    after: { ...newProvider, id: ref.id },
    ip: parseIp(request),
  });

  return ok(
    { providerId: ref.id, code: d.code, name: d.name },
    `Provider "${d.name}" registered. Enable it when ready.`,
    201
  );
}

// ─── PUT /api/internal/providers — update provider config ────────────────────

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateProviderSchema.safeParse(body);
  if (!parsed.success) return err((parsed.error as any).errors[0].message, 422);

  const { providerId, isActive, priority, services, lowFloatThresholdKobo, autoFundEnabled, autoFundAmountKobo } = parsed.data;

  const ref = adminDb.collection('providers').doc(providerId);
  const snap = await ref.get();
  if (!snap.exists) return err('Provider not found.', 404);

  const before = { id: snap.id, ...snap.data() } as ProviderConfig;

  const providerUpdates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (isActive !== undefined) providerUpdates.isActive = isActive;
  if (priority !== undefined) providerUpdates.priority = priority;
  if (services !== undefined) providerUpdates.services = services;

  await ref.update(providerUpdates);

  // Update float config if relevant fields changed
  if (lowFloatThresholdKobo !== undefined || autoFundEnabled !== undefined || autoFundAmountKobo !== undefined) {
    const floatUpdates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (lowFloatThresholdKobo !== undefined) floatUpdates.lowThreshold = lowFloatThresholdKobo;
    if (autoFundEnabled !== undefined) floatUpdates.autoFundEnabled = autoFundEnabled;
    if (autoFundAmountKobo !== undefined) floatUpdates.autoFundAmount = autoFundAmountKobo;

    await adminDb.collection('provider_floats').doc(providerId).set(floatUpdates, { merge: true });
  }

  invalidateProviderConfigCache();

  await writeAuditLog({
    adminId: ctx.uid,
    action: isActive === true
      ? 'provider:enable'
      : isActive === false
      ? 'provider:disable'
      : 'provider:update',
    resource: 'providers',
    targetId: providerId,
    before,
    after: { ...providerUpdates, id: providerId },
    ip: parseIp(request),
  });

  return ok(
    { providerId, updated: providerUpdates },
    `Provider "${before.name}" updated.`
  );
}

// ─── DELETE /api/internal/providers — soft-disable (never hard-delete) ───────
// We never hard-delete providers — they have transaction history.
// Disabling sets isActive = false; the record is retained indefinitely.

export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(request, PERMISSIONS.PROVIDERS_WRITE);
  } catch (e) {
    return handleAuthError(e);
  }

  const body = await request.json().catch(() => null);
  const providerId: string = body?.providerId;
  if (!providerId) return err('providerId is required', 422);

  const ref = adminDb.collection('providers').doc(providerId);
  const snap = await ref.get();
  if (!snap.exists) return err('Provider not found.', 404);

  const provider = snap.data() as ProviderConfig;
  if (!provider.isActive) return err('Provider is already disabled.', 400);

  await ref.update({ isActive: false, updatedAt: Timestamp.now() });
  invalidateProviderConfigCache();

  await writeAuditLog({
    adminId: ctx.uid,
    action: 'provider:disable',
    resource: 'providers',
    targetId: providerId,
    before: { isActive: true },
    after: { isActive: false },
    ip: parseIp(request),
  });

  return ok({ providerId }, `Provider "${provider.name}" disabled.`);
}