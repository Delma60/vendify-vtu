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
import { ProviderFactory } from '@/lib/providers/factory';
import type { ProviderConfig, ServiceType, ProviderAuthMethod } from '@/types/provider';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_SERVICES: ServiceType[] = ['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'];
const VALID_AUTH_METHODS: ProviderAuthMethod[] = ['api_key', 'basic', 'bearer', 'token_login'];
const ServiceEnum = z.enum(['airtime', 'data', 'cable', 'electricity', 'exam', 'sms']);

const UpdateProviderSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  isActive: z.boolean().optional(),
  priority: z
    .record(ServiceEnum, z.number().int().min(1).max(99))
    .optional(),
  services: z.array(ServiceEnum).optional(),
  lowFloatThresholdKobo: z.number().int().min(0).optional(),
  autoFundEnabled: z.boolean().optional(),
  autoFundAmountKobo: z.number().int().min(0).optional(),
});

const CreateProviderSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores only'),
    name: z.string().min(2).max(80),
    baseUrl: z.string().url('Base URL must be a valid URL'),
    identifier: z.string().min(2).max(60),
    services: z.array(ServiceEnum).min(1),
    priority: z
      .record(ServiceEnum, z.number().int().min(1).max(99))
      .optional()
      .default({}),
    lowFloatThresholdKobo: z.number().int().min(0).optional().default(5_000_000), // ₦50,000
    autoFundEnabled: z.boolean().optional().default(false),
    autoFundAmountKobo: z.number().int().min(0).optional().default(0),

    // ── Credentials — conditionally required per authMethod ──────────────────
    authMethod: z.enum(['api_key', 'basic', 'bearer', 'token_login']),
    apiKey: z.string().optional().default(''),
    publicKey: z.string().optional().default(''),
    secretKey: z.string().optional().default(''),
    username: z.string().optional().default(''),
    password: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    switch (data.authMethod) {
      case 'api_key':
      case 'bearer':
        if (!data.apiKey) {
          ctx.addIssue({ code: 'custom', path: ['apiKey'], message: 'API key is required' });
        }
        break;
      case 'basic':
        if (!data.username) {
          ctx.addIssue({ code: 'custom', path: ['username'], message: 'Username is required' });
        }
        if (!data.password) {
          ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' });
        }
        break;
      case 'token_login':
        if (!data.username) {
          ctx.addIssue({ code: 'custom', path: ['username'], message: 'Username is required' });
        }
        if (!data.password) {
          ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' });
        }
        break;
    }
  });

// ─── Helper: fetch live provider balance ──────────────────────────────────────

async function fetchProviderBalance(config: ProviderConfig): Promise<number | null> {
  try {
    const instance = ProviderFactory.make(config);
    return await instance.getBalance();
  } catch {
    return null;
  }
}

async function fetchProviderHealth(config: ProviderConfig): Promise<'healthy' | 'degraded' | 'down'> {
  try {
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

// ─── Mask sensitive credential fields ─────────────────────────────────────────

function maskCredentials(p: ProviderConfig): Partial<ProviderConfig> {
  const masked: any = { ...p };
  if (masked.apiKey) {
    masked.apiKey = `${masked.apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, masked.apiKey.length - 6))}`;
  }
  if (masked.secretKey) masked.secretKey = '••••••••';
  if (masked.publicKey && masked.publicKey.length > 8) {
    masked.publicKey = `${masked.publicKey.slice(0, 8)}••••`;
  }
  if (masked.password) masked.password = '••••••••';
  // username is safe to show (it's usually an email)
  return masked;
}

// ─── GET /api/internal/providers ─────────────────────────────────────────────

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

  let providers;
  if (withHealth) {
    providers = await Promise.all(
      rawProviders.map(async (p) => {
        const [status, balanceKobo] = await Promise.all([
          fetchProviderHealth(p),
          fetchProviderBalance(p),
        ]);
        return {
          ...maskCredentials(p),
          liveStatus: status,
          liveBalanceKobo: balanceKobo,
        };
      })
    );
  } else {
    providers = await Promise.all(
      rawProviders.map(async (p) => {
        const floatSnap = await adminDb.collection('provider_floats').doc(p.id).get();
        const float = floatSnap.exists ? floatSnap.data() : null;
        return {
          ...maskCredentials(p),
          liveStatus: null,
          cachedBalanceKobo: (float as { balance?: number } | null)?.balance ?? null,
          lowFloatThresholdKobo: (float as { lowThreshold?: number } | null)?.lowThreshold ?? null,
          lastCheckedAt: (float as { lastCheckedAt?: unknown } | null)?.lastCheckedAt ?? null,
        };
      })
    );
  }

  // Build service routing map
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
    activeCount: providers.filter((p: any) => p.isActive).length,
  });
}

// ─── POST /api/internal/providers ────────────────────────────────────────────

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

  // Guard: code must match a registered implementation
  if (!ProviderFactory.isRegistered(d.code)) {
    return err(
      `No implementation found for code "${d.code}". ` +
      `Available codes: ${ProviderFactory.getRegistry().map(r => r.code).join(', ')}`,
      400,
      'UNKNOWN_PROVIDER_CODE'
    );
  }

  // Guard: code must be unique in Firestore
  // Guard: webhook identifier must be unique in Firestore
  const existing = await adminDb.collection('providers').where('identifier', '==', d.identifier).limit(1).get();
  if (!existing.empty) {
    return err(`A provider with the webhook identifier '${d.identifier}' already exists. Please choose a unique identifier.`, 409);
  }

  const ref = adminDb.collection('providers').doc();
  const now = Timestamp.now();

  const newProvider: Omit<ProviderConfig, 'id'> = {
    code: d.code,
    name: d.name,
    baseUrl: d.baseUrl,
    authMethod: d.authMethod,
    apiKey: d.apiKey,
    publicKey: d.publicKey,
    secretKey: d.secretKey,
    username: d.username,
    password: d.password,
    identifier: d.identifier,
    isActive: false,     // starts inactive — must be explicitly enabled
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
    after: { ...maskCredentials({ ...newProvider, id: ref.id } as ProviderConfig), id: ref.id },
    ip: parseIp(request),
  });

  return ok(
    { providerId: ref.id, code: d.code, name: d.name },
    `Provider "${d.name}" registered. Enable it when ready.`,
    201
  );
}

// ─── PUT /api/internal/providers ─────────────────────────────────────────────

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
    action: isActive === true ? 'provider:enable' : isActive === false ? 'provider:disable' : 'provider:update',
    resource: 'providers',
    targetId: providerId,
    before,
    after: { ...providerUpdates, id: providerId },
    ip: parseIp(request),
  });

  return ok({ providerId, updated: providerUpdates }, `Provider "${before.name}" updated.`);
}

// ─── DELETE /api/internal/providers ──────────────────────────────────────────

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