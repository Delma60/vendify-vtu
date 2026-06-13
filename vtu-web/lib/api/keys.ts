// vtu-web/lib/api/keys.ts
// AGENTS.md RULES: #4 (zod), #5 (idempotency), #9 (log every external call)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - createHash from crypto
// - generateApiKey from @/lib/utils/crypto
// - validateApiKeyRequest from @/lib/utils/validators
// - logExternalCall from @/lib/utils/logger

// ─── API KEY MANAGEMENT ─────────────────────────────────────────────────────────

// FUNCTION: generateApiKey(userId, label, scopes)
// PURPOSE : Create a new API key record and return raw key to user.
// PARAMS  : userId: string, label: string, scopes: string[]
// RETURNS : Promise<{ apiKey: string, apiKeyId: string }>
//
// STEPS:
//   1. Validate inputs with Zod.
//   2. Generate random API key string.
//   3. Hash key with SHA-256 and store keyHash.
//   4. Persist api_keys document with metadata and limits.
//   5. Return raw key and document ID.

// FUNCTION: validateApiKey(rawKey)
// PURPOSE : Verify API key and return key record.
// PARAMS  : rawKey: string
// RETURNS : Promise<ApiKeyRecord | null>
//
// STEPS:
//   1. Compute SHA-256 hash of rawKey.
//   2. Query api_keys where keyHash == hashed value and isActive == true.
//   3. Return record or null.
