// vtu-web/app/api/internal/providers/route.ts
// AGENTS.md RULES: #4 (zod), #9 (log every external call), #14 (runtime config)

// IMPORTS NEEDED:
// - NextResponse from next/server
// - requirePermission from @/lib/roles/middleware
// - listProviders, updateProviderConfig from @/lib/providers/service
// - validateProviderConfigRequest from @/lib/utils/validators
// - logExternalCall from @/lib/utils/logger

// ─── ROUTE HANDLER ─────────────────────────────────────────────────────────────

// HANDLER: GET
// PURPOSE : Admin endpoint to list provider configurations.
// REQUEST : optional query params for active status.
// RETURNS : JSON with provider config list.
//
// STEPS:
//   1. Require permission providers:read.
//   2. Validate query params.
//   3. Call listProviders().
//   4. Return provider configs.

// HANDLER: PUT
// PURPOSE : Update provider routing or credentials.
// REQUEST : body with providerId and config updates.
// RETURNS : JSON with updated provider record.
//
// STEPS:
//   1. Require permission providers:write.
//   2. Validate request body.
//   3. Call updateProviderConfig().
//   4. Return updated config.

export async function GET(request: Request) {
  // route implementation placeholder
}

export async function PUT(request: Request) {
  // route implementation placeholder
}
