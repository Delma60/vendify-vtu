// vtu-web/middleware.ts
// Edge-compatible middleware. JWT reads ONLY — no Firestore, no Admin SDK.
// Fine-grained permission checks happen inside route handlers via requirePermission().

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';

// ─── Role tiers ───────────────────────────────────────────────────────────────
// Roles that may access admin UI / internal API routes at all.
// Actual permission gates are still enforced server-side per route.
const ADMIN_ROLE_IDS = new Set([
  'super_admin',
  'admin',
  'support_agent',
  'finance_officer',
  'marketing_manager',
]);

// ─── Route classification ─────────────────────────────────────────────────────

// Require valid session
const PROTECTED = ['/dashboard', '/api/v1/'];

// Require valid session AND an admin-tier roleId
const ADMIN_ONLY = ['/admin', '/api/internal/'];

// Redirect to /dashboard if already authenticated
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

// Always pass through (no session check)
const PUBLIC_PASS = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/health',
  '/api/v1/plans',   // public plan listing
  '/maintenance',
  '/_next',
  '/favicon',
];

function classify(pathname: string): 'public' | 'auth-page' | 'protected' | 'admin' {
  if (PUBLIC_PASS.some((p) => pathname.startsWith(p))) return 'public';
  // static files (.js, .css, .png …)
  if (/\.\w+$/.test(pathname)) return 'public';
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) return 'auth-page';
  if (ADMIN_ONLY.some((p) => pathname.startsWith(p))) return 'admin';
  if (PROTECTED.some((p) => pathname.startsWith(p))) return 'protected';
  return 'public';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);
  const type = classify(pathname);

  // ── Maintenance mode (env flag only — Firestore read happens server-side) ──
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

  // ── Resolve session from cookie (JWT only, no Firestore) ──────────────────
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

  // ── Admin-only guard (coarse — fine permissions checked in handlers) ───────
  if (type === 'admin') {
    if (!ADMIN_ROLE_IDS.has(session.roleId)) {
      if (pathname.startsWith('/api/')) return jsonForbidden('Forbidden', 403);
      // Regular customers see their dashboard, not an error page
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
    /*
     * Match everything except Next.js internals and static files already
     * served by the CDN. Using a negative lookahead keeps this list short.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};