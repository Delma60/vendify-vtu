// vtu-web/lib/api/rate-limit.ts
// AGENTS.md RULES: #4 (zod), #5 (idempotency), #12 (staging separate)

// IMPORTS NEEDED:
// - Redis client from @/lib/utils/redis
// - validateRateLimitKey from @/lib/utils/validators
// - logExternalCall from @/lib/utils/logger

// ─── RATE LIMITING ──────────────────────────────────────────────────────────────

// FUNCTION: checkRateLimit(key, limit, windowSeconds)
// PURPOSE : Enforce a per-key rate limit.
// PARAMS  : key: string, limit: number, windowSeconds: number
// RETURNS : Promise<{ allowed: boolean, remaining: number, reset: number }>
//
// STEPS:
//   1. Normalize key and validate inputs.
//   2. Increment request counter in Redis or Upstash.
//   3. Compute remaining quota and reset timestamp.
//   4. Return allowed=false if quota exceeded.

// FUNCTION: getRateLimitHeaders(key)
// PURPOSE : Build HTTP headers for rate limit state.
// PARAMS  : key: string
// RETURNS : Promise<Record<string,string>>
//
// STEPS:
//   1. Read current counter and TTL from Redis.
//   2. Format X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
//   3. Return header map.
