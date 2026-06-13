/**
 * Login attempt throttling & account lockout
 *
 * Rules (per AGENTS.md):
 *  - 5 failed attempts within 15 minutes → lock account for 15 minutes
 *  - Keyed by IP address  (primary)  and  email  (secondary)
 *  - Uses Upstash Redis when configured, falls back to in-memory Map for dev
 */

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 min
const LOCKOUT_SECONDS = 15 * 60; // 15 min

// ─── Redis client (lazy-loaded) ───────────────────────────────────────────────

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { Redis } = await import('@upstash/redis');
  return new Redis({ url, token });
}

// ─── In-memory fallback (dev only) ───────────────────────────────────────────

const memStore = new Map<string, { count: number; lockedUntil: number | null; windowStart: number }>();

function memKey(key: string) {
  const now = Date.now();
  const entry = memStore.get(key) ?? { count: 0, lockedUntil: null, windowStart: now };

  // Reset if window expired
  if (now - entry.windowStart > WINDOW_SECONDS * 1000) {
    const fresh = { count: 0, lockedUntil: null, windowStart: now };
    memStore.set(key, fresh);
    return fresh;
  }
  return entry;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if the key is currently locked out */
export async function isLockedOut(key: string): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    const lockUntil = await redis.get<number>(`lockout:${key}`);
    if (lockUntil && Date.now() < lockUntil) return true;
    return false;
  }

  const entry = memKey(key);
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  return false;
}

/**
 * Record a failed attempt.
 * Returns { locked: true, retryAfterSeconds } if the account is now locked,
 * or { locked: false, attemptsRemaining } otherwise.
 */
export async function recordFailedAttempt(
  key: string
): Promise<
  | { locked: true; retryAfterSeconds: number }
  | { locked: false; attemptsRemaining: number }
> {
  const redis = await getRedis();

  if (redis) {
    const countKey = `attempts:${key}`;
    const lockKey = `lockout:${key}`;

    const count = await redis.incr(countKey);
    if (count === 1) await redis.expire(countKey, WINDOW_SECONDS);

    if (count >= MAX_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      await redis.set(lockKey, lockedUntil, { ex: LOCKOUT_SECONDS });
      await redis.del(countKey);
      return { locked: true, retryAfterSeconds: LOCKOUT_SECONDS };
    }

    return { locked: false, attemptsRemaining: MAX_ATTEMPTS - count };
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memKey(key);
  entry.count += 1;
  memStore.set(key, entry);

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    entry.count = 0;
    return { locked: true, retryAfterSeconds: LOCKOUT_SECONDS };
  }

  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - entry.count };
}

/** Clear failed attempts on successful login */
export async function clearAttempts(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(`attempts:${key}`, `lockout:${key}`);
    return;
  }
  memStore.delete(key);
}

/** Composite key: "ip:email" */
export function attemptKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`;
}