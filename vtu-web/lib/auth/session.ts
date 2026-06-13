import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { SessionPayload } from '@/types';

const SESSION_COOKIE = 'vtu_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds
const secret = new TextEncoder().encode(
  process.env.API_JWT_SECRET ?? 'change-me-in-production-min-32-chars!!'
);

// ─── Token generation ─────────────────────────────────────────────────────────

export async function signSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ─── Current session ──────────────────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return verifySessionToken(token);
}

// ─── Short-lived tokens (email verify / password reset / 2FA) ────────────────

const OTP_DURATION = 60 * 15; // 15 minutes

export async function signOtpToken(payload: { uid: string; purpose: string }): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OTP_DURATION}s`)
    .sign(secret);
}

export async function verifyOtpToken(
  token: string,
  expectedPurpose: string
): Promise<{ uid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if ((payload as { purpose?: string }).purpose !== expectedPurpose) return null;
    return { uid: payload.uid as string };
  } catch {
    return null;
  }
}