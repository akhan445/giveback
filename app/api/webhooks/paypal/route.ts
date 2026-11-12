import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { handleWebhookEvent } from '@/lib/payments';
import { verifyPayoutWebhook } from '@/lib/paypal-payouts';

// PayPal calls this when something happens. We verify the signature first, then store the
// event once. A 5xx makes PayPal retry later; a 2xx tells it we have the event.
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event?.id || !event?.event_type) return NextResponse.json({ error: 'bad event' }, { status: 400 });

  // Checkout events come from the merchant app; payout events come from the platform app, which has its own
  // webhook id. Accept the event if either verification passes.
  const genuine =
    (await verifyWebhookSignature(req.headers, event).catch(() => false)) ||
    (await verifyPayoutWebhook(req.headers, event).catch(() => false));
  if (!genuine) return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  const result = await handleWebhookEvent(event);
  return NextResponse.json({ result });
}
