import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';
 
// Routes where a missing PIN should trigger a redirect
const PIN_REQUIRED_PREFIXES = [
  '/airtime',
  '/data',
  '/electricity',
  '/cable',
  '/exam-pin',
  '/wallet',
  '/transactions',
  '/api/v1/airtime',
  '/api/v1/data',
  '/api/v1/electricity',
  '/api/v1/cable',
];
 
// Routes that are always accessible regardless of PIN status
const PIN_EXEMPT = ['/set-pin', '/api/auth/set-pin', '/api/auth/logout'];
 
export async function pinCheckMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
 
  // Skip exempt paths
  if (PIN_EXEMPT.some((p) => pathname.startsWith(p))) return null;
 
  // Only enforce on service/wallet routes
  const requiresPin = PIN_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!requiresPin) return null;
 
  // Read session
  const token = request.cookies.get('vtu_session')?.value;
  if (!token) return null; // auth middleware will handle this
 
  const session = await verifySessionToken(token);
  if (!session) return null;
 
  // If PIN not set, redirect to set-pin page
  if (!session.pinSet) {
    const url = request.nextUrl.clone();
    url.pathname = '/set-pin';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
 
  return null;
}