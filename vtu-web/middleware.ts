// vtu-web/middleware.ts
// Edge-compatible middleware. JWT reads ONLY — no Firestore, no Admin SDK.
// Fine-grained permission checks happen inside route handlers via requirePermission().

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';
import type { SessionPayload } from '@/types'; // ensure you import your session type
import { pinCheckMiddleware } from './lib/auth/pin';

// ─── Role tiers ───────────────────────────────────────────────────────────────
// Roles that may access admin UI / internal API routes at all.
const ADMIN_ROLE_IDS = new Set([
  'super_admin',
  'admin',
  'support_agent',
  'finance_officer',
  'marketing_manager',
]);

// ─── Route classification ─────────────────────────────────────────────────────

// Require valid session
const PROTECTED = [
  '/dashboard', 
  '/api/v1/',
  '/airtime',
  '/data',
  '/electricity',
  '/cable',
  '/exam-pin',
  '/wallet',
  '/transactions',
  '/cashback',
  '/set-pin' // Protect the setup page too!
];
const ADMIN_ONLY = ['/admin', '/api/internal/'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];
const PUBLIC_PASS = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/health',
  '/api/v1/plans',
  '/maintenance',
  '/_next',
  '/favicon',
];


function classify(pathname: string): 'public' | 'auth-page' | 'protected' | 'admin' {
  if (PUBLIC_PASS.some((p) => pathname.startsWith(p))) return 'public';
  if (/\.\w+$/.test(pathname)) return 'public';
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) return 'auth-page';
  if (ADMIN_ONLY.some((p) => pathname.startsWith(p))) return 'admin';
  if (PROTECTED.some((p) => pathname.startsWith(p))) return 'protected';
  return 'public';
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function jsonForbidden(message: string, status: 401 | 403 | 503) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── PIN Check Helper ─────────────────────────────────────────────────────────


// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);
  const type = classify(pathname);

  // ── Maintenance mode ──
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  const bypassIps = (process.env.MAINTENANCE_BYPASS_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (maintenanceMode && !bypassIps.includes(ip)) {
    if (pathname.startsWith('/api/')) {
      return jsonForbidden('Service temporarily unavailable', 503);
    }
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  // ── Public routes — pass straight through ─────────────────────────────────
  if (type === 'public') return NextResponse.next();

  // ── Resolve session from cookie ───────────────────────────────────────────
  const token = request.cookies.get('vtu_session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  // ── Auth pages — redirect logged-in users ─────────────────────────────────
  if (type === 'auth-page') {
    if (session) {
      const dest = ADMIN_ROLE_IDS.has(session.roleId) ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // ── Unauthenticated — reject or redirect ──────────────────────────────────
  if (!session) {
    if (pathname.startsWith('/api/')) return jsonForbidden('Unauthorized', 401);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── PIN gate (runs for authenticated users) ───────────────────────────────
  const pinRedirect = await pinCheckMiddleware(request);
  if (pinRedirect) return pinRedirect;

  // ── Admin-only guard ──────────────────────────────────────────────────────
  if (type === 'admin') {
    if (!ADMIN_ROLE_IDS.has(session.roleId)) {
      if (pathname.startsWith('/api/')) return jsonForbidden('Forbidden', 403);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ── Forward identity to route handlers via headers ────────────────────────
  const headers = new Headers(request.headers);
  headers.set('x-uid', session.uid);
  headers.set('x-role-id', session.roleId);
  headers.set('x-session-id', session.sessionId);
  headers.set('x-client-ip', ip);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};