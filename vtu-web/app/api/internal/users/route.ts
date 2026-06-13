// vtu-web/app/api/internal/users/route.ts
// AGENTS.md RULES: #4 (zod), #5 (idempotency), #9 (log every external call)

// IMPORTS NEEDED:
// - NextResponse from next/server
// - requirePermission from @/lib/roles/middleware
// - listUsers, updateUser from @/lib/users/service
// - validateAdminUsersRequest from @/lib/utils/validators
// - logExternalCall from @/lib/utils/logger

// ─── ROUTE HANDLER ─────────────────────────────────────────────────────────────

// HANDLER: GET
// PURPOSE : Admin-only endpoint to list users.
// REQUEST : query params for pagination and filters.
// RETURNS : JSON with users[] and pagination.
//
// STEPS:
//   1. Require permission users:read.
//   2. Validate query params.
//   3. Call listUsers() with filters.
//   4. Return results.
//
// HANDLER: PUT
// PURPOSE : Admin-only endpoint to update user data.
// REQUEST : body with userId and updated fields.
// RETURNS : JSON with updated user record.
//
// STEPS:
//   1. Require permission users:write.
//   2. Validate request body.
//   3. Call updateUser().
//   4. Return updated user.

export async function GET(request: Request) {
  // route implementation placeholder
}

export async function PUT(request: Request) {
  // route implementation placeholder
}
