// vtu-web/lib/ip/blacklist.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #12 (staging separate)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - parseCidr from @/lib/utils/network
// - logExternalCall from @/lib/utils/logger

// ─── IP BLACKLIST ─────────────────────────────────────────────────────────────

// FUNCTION: isBlacklisted(ip)
// PURPOSE : Check whether an IP address is blocked globally.
// PARAMS  : ip: string
// RETURNS : Promise<boolean>
//
// STEPS:
//   1. Normalize IP string.
//   2. Query ip_blacklist collection for active entries.
//   3. Match exact IP or CIDR ranges.
//   4. Return true if blocked, false otherwise.

// FUNCTION: addIpToBlacklist(ip, reason, addedBy)
// PURPOSE : Add a new IP or CIDR range to the blacklist.
// PARAMS  : ip: string, reason: string, addedBy: string
// RETURNS : Promise<string> — blacklist document ID.
//
// STEPS:
//   1. Validate IP/CIDR format.
//   2. Create ip_blacklist document with metadata.
//   3. Return document ID.
