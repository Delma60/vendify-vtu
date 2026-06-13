import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/utils/response';
import { getSession, clearSessionCookie } from '@/lib/auth/session';
import { revokeSession } from '@/lib/auth/device';

export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session) return err('Not authenticated', 401);

  await revokeSession(session.uid, session.sessionId).catch(console.error);
  await clearSessionCookie();

  return ok(null, 'Logged out successfully.');
}