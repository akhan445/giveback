import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { priceOrder, orderRequestSchema } from '@/lib/catalog';
import { centsToDecimal } from '@/lib/money';
import { createOrder } from '@/lib/paypal';

// Creates a PayPal order. The price is computed here from server-side data, never from the client.
export async function POST(req: Request) {
  const parsed = orderRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });

  let priced;
  try {
    priced = priceOrder(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const order = await createOrder(centsToDecimal(priced.totalCents), priced.currency, priced.description, randomUUID());
  return NextResponse.json({ id: order.id, totalCents: priced.totalCents, currency: priced.currency });
}
