// vtu-web/app/api/webhooks/flutterwave/route.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #5 (idempotency)

import { NextRequest, NextResponse } from 'next/server';
import { handleFlutterwaveWebhook } from '@/lib/flutterwave/webhooks';

export async function POST(request: NextRequest) {
  // Read raw body as text — required for HMAC signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('verif-hash') ?? '';

  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing signature' }, { status: 401 });
  }

  try {
    await handleFlutterwaveWebhook(rawBody, signature);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = (error as Error).message;

    if (message === 'Invalid webhook signature') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[webhook:flutterwave]', error);
    return NextResponse.json({ success: false, error: 'Processing error' }, { status: 500 });
  }
}