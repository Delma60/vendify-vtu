import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';

export function ok<T>(data: T, message?: string, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, ...(message ? { message } : {}) }, { status });
}

export function err(error: string, status = 400, code?: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

export function parseIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') ?? 'unknown';
}