import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { priceOrder, orderRequestSchema } from '@/lib/catalog';
import { centsToDecimal } from '@/lib/money';
import { feeCoverTag } from '@/lib/fees';
import { approveLink, createOrder } from '@/lib/paypal';
import { getOrgProfile } from '@/lib/history';
import { allow, clientKey } from '@/lib/rate-limit';

// Creates a PayPal order. The price is computed here from server-side data, never from the client.
// With `phone: true` the supporter pays on their own phone: we also return the link to open there
// (the counter shows it as a QR code), and PayPal sends the phone back to /pay/return afterwards.
export async function POST(req: Request) {
  const parsed = orderRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });

  let priced;
  try {
    priced = priceOrder(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // QR / phone orders can be started by anyone who opens the public donate page, so pace them per device.
  if (parsed.data.phone && !allow(clientKey(req.headers))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  // The phone must be able to reach this address: set NEXT_PUBLIC_APP_URL to the public site (not localhost).
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
  const phone = parsed.data.phone
    ? { returnUrl: `${base}/pay/return`, cancelUrl: `${base}/pay/cancelled`, brandName: (await getOrgProfile()).name }
    : undefined;

  const order = await createOrder(centsToDecimal(priced.totalCents), priced.currency, priced.description, feeCoverTag(priced.feeCoverCents, parsed.data.anonymous === true), randomUUID(), phone);
  if (phone) {
    const approveUrl = approveLink(order.links);
    if (!approveUrl) return NextResponse.json({ error: 'PayPal did not return a payment link' }, { status: 502 });
    return NextResponse.json({ id: order.id, approveUrl, totalCents: priced.totalCents, currency: priced.currency });
  }
  return NextResponse.json({ id: order.id, totalCents: priced.totalCents, currency: priced.currency });
}
