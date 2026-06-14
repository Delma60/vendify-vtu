import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';

// ─── Route matchers ───────────────────────────────────────────────────────────

/** Routes that require authentication */
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/api/internal'];

/** Routes that must NOT be accessible when logged in */
const AUTH_ONLY_PREFIXES = ['/login', '/register'];

/** Public API routes — skip auth but still rate-limit */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/v1/',
  '/api/webhooks/',
  '/api/health',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function getSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get('vtu_session')?.value;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Static assets & Next internals — skip ────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const ip = getIp(request);

  // ── 1. Maintenance mode (edge KV or env flag) ──────────────────────────────
  // Full maintenance check is in the server (reads Firestore via Admin SDK).
  // At the edge we only check a pre-computed flag stored in the response header
  // set by the warm-up cron. In practice wire this to Upstash or an edge KV.
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  const bypassIps = (process.env.MAINTENANCE_BYPASS_IPS ?? '').split(',').map((s) => s.trim());

  if (maintenanceMode && !bypassIps.includes(ip)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  // ── 2. Session resolution ──────────────────────────────────────────────────
  const token = getSessionToken(request);
  const session = token ? await verifySessionToken(token) : null;
  console.log(request.cookies.getAll())

  // ── 3. Auth route redirect (already logged in) ─────────────────────────────
  if (session && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── 4. Protected route guard ───────────────────────────────────────────────
  if (isProtected(pathname)) {
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin route: require non-customer role (fine-grained permission check happens in route handler)
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/internal')) {
      if (session.roleId === 'customer') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Forward uid + roleId to the route via request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-uid', session.uid);
    requestHeaders.set('x-role-id', session.roleId);
    requestHeaders.set('x-session-id', session.sessionId);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimisation files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};