import { NextResponse } from 'next/server';
import { decimalToCents } from '@/lib/money';
import { parseOrderTag } from '@/lib/fees';
import { captureOrder } from '@/lib/paypal';
import { upsertPayment } from '@/lib/payments';

// Captures the approved order and records the payment. The webhook reports the same
// capture later; upsertPayment makes that harmless.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await captureOrder(id);
  const unit = result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return NextResponse.json({ error: 'no capture in response' }, { status: 502 });

  const tag = parseOrderTag(unit?.custom_id);
  const name = [result.payer?.name?.given_name, result.payer?.name?.surname].filter(Boolean).join(' ');
  await upsertPayment({
    captureId: capture.id,
    orderId: result.id,
    amountCents: decimalToCents(capture.amount.value),
    currency: capture.amount.currency_code,
    feeCoveredCents: tag.feeCoverCents,
    anonymous: tag.anonymous,
    payerName: name || null,
    payerCountry: result.payer?.address?.country_code ?? null,
    feeCents: decimalToCents(capture.seller_receivable_breakdown?.paypal_fee?.value ?? '0'),
    status: capture.status,
    kind: unit?.description?.startsWith('Donation') ? 'donation' : 'sale',
    description: unit?.description,
    payerEmail: result.payer?.email_address,
    source: 'capture',
  });
  return NextResponse.json({
    status: capture.status,
    captureId: capture.id,
    payerFirstName: result.payer?.name?.given_name ?? null,
  });
}
