// Capturing an approved PayPal order and recording the payment. Used by the counter device (PayPal
// button) and by the page a supporter lands on after paying on their phone (QR code). The webhook
// reports the same capture later; upsertPayment makes that harmless, and PayPal replays the result
// of a repeated capture request, so refreshing the page never double-charges.
import { parseOrderTag } from './fees';
import { decimalToCents } from './money';
import { captureOrder } from './paypal';
import { upsertPayment } from './payments';

export type Captured = {
  status: string;
  captureId: string;
  amountCents: number;
  currency: string;
  payerFirstName: string | null;
  anonymous: boolean;
};

export async function captureAndRecord(orderId: string): Promise<Captured> {
  const result = await captureOrder(orderId);
  const unit = result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) throw new Error('no capture in response');

  const tag = parseOrderTag(unit?.custom_id);
  const name = [result.payer?.name?.given_name, result.payer?.name?.surname].filter(Boolean).join(' ');
  const amountCents = decimalToCents(capture.amount.value);
  await upsertPayment({
    captureId: capture.id,
    orderId: result.id,
    amountCents,
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
  return {
    status: capture.status,
    captureId: capture.id,
    amountCents,
    currency: capture.amount.currency_code,
    payerFirstName: tag.anonymous ? null : (result.payer?.name?.given_name ?? null),
    anonymous: tag.anonymous,
  };
}
