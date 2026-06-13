import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', uptime: new Date().toISOString() });
}
