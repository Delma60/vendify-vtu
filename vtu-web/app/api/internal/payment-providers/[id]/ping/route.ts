// vtu-web/app/api/internal/payment-providers/[id]/ping/route.ts
// AGENTS.md RULES: #3 (payments go through the gateway layer), #9 (log every external call)
//
// This performs a REAL outbound request to the gateway (a balance check) to
// confirm the stored credentials actually work — not a heuristic. It bridges
// the legacy `payment_providers` admin collection to the real
// PaymentGatewayFactory/PaymentGatewayInterface used by lib/payments/router.ts.
//
// LIMITATION: a live handshake is only possible for provider rows whose `id`
// exactly matches a code registered in PaymentGatewayFactory (currently just
// "flutterwave") AND has a known base URL below. Anything else returns
// reason: "unsupported" rather than pretending to succeed or fail.

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, err } from '@/lib/utils/response';
import { PaymentGatewayFactory } from '@/lib/payments/factory';
import type { PaymentGatewayConfig } from '@/types/payment';

// Base URLs for gateways reachable from this legacy admin page. The
// canonical source of truth for this (baseUrl, capabilities, priority, etc.)
// is the `payment_gateways` Firestore collection consumed by
// lib/payments/config.ts — this map exists only so "Test connection" can
// work against a `payment_providers` row that predates that system.
const BASE_URLS: Record<string, string> = {
  flutterwave: 'https://api.flutterwave.com/v3',
};

interface ProviderDoc {
  name: string;
  isActive: boolean;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const roleId = request.headers.get('x-role-id');
  if (roleId !== 'super_admin' && roleId !== 'admin') {
    return err('Forbidden', 403);
  }

  const { id } = params;

  try {
    const snap = await adminDb.collection('payment_providers').doc(id).get();
    if (!snap.exists) return err('Payment provider not found', 404);

    const provider = snap.data() as ProviderDoc;

    // Cheap local checks first — no point making a network call for these.
    if (!provider.isActive) {
      return ok({ healthy: false, reason: 'inactive' }, 'Gateway is inactive');
    }
    if (!provider.publicKey || !provider.secretKey || !provider.webhookSecret) {
      return ok({ healthy: false, reason: 'incomplete' }, 'Gateway is missing credentials');
    }
    if (!PaymentGatewayFactory.isRegistered(id) || !BASE_URLS[id]) {
      return ok(
        { healthy: false, reason: 'unsupported' },
        'No live handshake is implemented for this gateway yet'
      );
    }

    const config: PaymentGatewayConfig = {
      id,
      code: id,
      name: provider.name,
      baseUrl: BASE_URLS[id],
      authMethod: 'secret_key',
      publicKey: provider.publicKey,
      secretKey: provider.secretKey,
      webhookSecret: provider.webhookSecret,
      identifier: id,
      isActive: provider.isActive,
      capabilities: ['fund', 'payout', 'virtual_account'],
      priority: {},
    };

    const gateway = PaymentGatewayFactory.make(config);

    const startedAt = Date.now();
    try {
      // getBalance() is the cheapest authenticated, read-only call every
      // gateway implementation must support — calling it directly (rather
      // than the swallow-everything isHealthy() wrapper) lets us surface the
      // real failure reason (bad key, timeout, etc.) back to the admin.
      await gateway.getBalance();
      return ok(
        { healthy: true, latencyMs: Date.now() - startedAt },
        'Handshake succeeded'
      );
    } catch (error: any) {
      return ok(
        {
          healthy: false,
          reason: 'unreachable',
          message: error?.message || 'Gateway did not respond as expected',
          latencyMs: Date.now() - startedAt,
        },
        'Handshake failed'
      );
    }
  } catch (error: any) {
    return err(error.message || 'Failed to test gateway connection', 500);
  }
}