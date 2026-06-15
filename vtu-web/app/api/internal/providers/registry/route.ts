// vtu-web/app/api/internal/providers/registry/route.ts
// Returns the list of registered provider implementations so the admin UI
// can populate the code dropdown and show the correct credential fields.
// No write — read-only, requires providers:read permission.

import { NextRequest } from 'next/server';
import { requirePermission, handleAuthError, PERMISSIONS } from '@/lib/roles/middleware';
import { ProviderFactory } from '@/lib/providers/factory';
import { ok } from '@/lib/utils/response';

/**
 * GET /api/internal/providers/registry
 *
 * Returns an array of ProviderRegistryEntry objects — one per registered
 * implementation class. The admin "Add provider" form uses this to:
 *   1. Populate the "Provider type" dropdown (so admins pick a real code).
 *   2. Show only the credential fields relevant to the chosen provider.
 *   3. Pre-tick the default services for that provider.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.PROVIDERS_READ);
  } catch (e) {
    return handleAuthError(e);
  }

  const registry = ProviderFactory.getRegistry();

  return ok({
    providers: registry,
    count: registry.length,
  });
}