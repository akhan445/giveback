import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { handleWebhookEvent } from '@/lib/payments';

// PayPal calls this when something happens. We verify the signature first, then store the
// event once. A 5xx makes PayPal retry later; a 2xx tells it we have the event.
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event?.id || !event?.event_type) return NextResponse.json({ error: 'bad event' }, { status: 400 });

  if (!(await verifyWebhookSignature(req.headers, event))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  const result = await handleWebhookEvent(event);
  return NextResponse.json({ result });
}
