// vtu-web/lib/geo/blocker.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #14 (runtime config)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - getGeoConfig from @/lib/utils/config
// - logExternalCall from @/lib/utils/logger

// ─── GEO BLOCKER ──────────────────────────────────────────────────────────────

// FUNCTION: isGeoBlocked(countryCode, ip)
// PURPOSE : Determine whether a country or IP should be blocked.
// PARAMS  : countryCode: string | undefined, ip: string | undefined
// RETURNS : Promise<boolean>
//
// STEPS:
//   1. Load geo_config settings from Firestore.
//   2. If defaultAllow is true:
//        - block only countries in blockedCountries.
//      Otherwise:
//        - allow only countries in allowedCountries.
//   3. Optionally override based on IP-level exceptions.
//   4. Return true if blocked.

// FUNCTION: getGeoBlockReason(countryCode)
// PURPOSE : Return human-readable reason for geo blocking.
// PARAMS  : countryCode: string | undefined
// RETURNS : string
//
// STEPS:
//   1. If countryCode is missing → return generic message.
//   2. Use geo_config values to build reason.
