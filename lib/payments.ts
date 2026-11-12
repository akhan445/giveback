// Recording payments. Two writers (the capture route and the webhook) can report the same
// payment; both go through upsertPayment, keyed by PayPal's capture id, so it is stored once.
import type { PoolClient } from 'pg';
import { db } from './db';
import { parseOrderTag, platformFeeCents } from './fees';
import { decimalToCents } from './money';
import { applyPayoutStatus } from './payouts';
import { applyInvoiceStatus } from './sponsors';
import { runAfterResponse, settleCapture } from './settlements';

export type PaymentInput = {
  captureId: string;
  orderId?: string | null;
  amountCents: number;
  currency: string;
  feeCents: number;
  feeCoveredCents?: number; // extra the supporter added to cover PayPal's fee
  status: string;
  kind: 'sale' | 'donation';
  description?: string | null;
  payerEmail?: string | null;
  payerName?: string | null;
  payerCountry?: string | null; // ISO 3166 alpha-2, from PayPal
  payerCity?: string | null;
  anonymous?: boolean; // the supporter asked not to be named publicly
  source: 'capture' | 'webhook' | 'seed';
};

type Queryable = Pick<PoolClient, 'query'>;

export async function upsertPayment(p: PaymentInput, q: Queryable = db()) {
  await q.query(
    `INSERT INTO payments (paypal_capture_id, paypal_order_id, amount_cents, currency, fee_cents, fee_covered_cents, status, kind, description, payer_email, source, payer_name, anonymous, payer_country, payer_city, platform_fee_cents)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (paypal_capture_id) DO UPDATE SET
       status        = EXCLUDED.status,
       fee_cents     = GREATEST(payments.fee_cents, EXCLUDED.fee_cents),
       fee_covered_cents = GREATEST(payments.fee_covered_cents, EXCLUDED.fee_covered_cents),
       paypal_order_id = COALESCE(payments.paypal_order_id, EXCLUDED.paypal_order_id),
       description   = COALESCE(payments.description, EXCLUDED.description),
       payer_email   = COALESCE(payments.payer_email, EXCLUDED.payer_email),
       payer_name    = COALESCE(payments.payer_name, EXCLUDED.payer_name),
       payer_country = COALESCE(payments.payer_country, EXCLUDED.payer_country),
       payer_city    = COALESCE(payments.payer_city, EXCLUDED.payer_city),
       anonymous     = payments.anonymous OR EXCLUDED.anonymous`,
    [p.captureId, p.orderId ?? null, p.amountCents, p.currency, p.feeCents, p.feeCoveredCents ?? 0, p.status, p.kind, p.description ?? null, p.payerEmail ?? null, p.source, p.payerName ?? null, p.anonymous ?? false, p.payerCountry ?? null, p.payerCity ?? null, platformFeeCents(p.amountCents, p.currency)],
  );
}

type WebhookEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { value: string; currency_code: string };
    seller_receivable_breakdown?: { paypal_fee?: { value: string } };
    supplementary_data?: { related_ids?: { order_id?: string } };
    // Payout events: a batch carries batch_header, an item carries payout_batch_id + transaction_status.
    batch_header?: { payout_batch_id?: string; batch_status?: string };
    payout_batch_id?: string;
    transaction_status?: string;
    // Invoicing events carry the invoice under `invoice`.
    invoice?: { id?: string; status?: string };
  };
};

/** Stores a verified webhook event once. Returns 'duplicate' if PayPal re-sent one we have. */
export async function handleWebhookEvent(event: WebhookEvent): Promise<'processed' | 'duplicate'> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      'INSERT INTO webhook_events (event_id, event_type, payload) VALUES ($1,$2,$3) ON CONFLICT (event_id) DO NOTHING RETURNING event_id',
      [event.id, event.event_type, JSON.stringify(event)],
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'duplicate';
    }
    const r = event.resource;
    const tag = parseOrderTag(r?.custom_id);
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && r?.id && r.amount) {
      await upsertPayment(
        {
          captureId: r.id,
          orderId: r.supplementary_data?.related_ids?.order_id,
          amountCents: decimalToCents(r.amount.value),
          currency: r.amount.currency_code,
          feeCents: decimalToCents(r.seller_receivable_breakdown?.paypal_fee?.value ?? '0'),
          feeCoveredCents: tag.feeCoverCents,
          anonymous: tag.anonymous,
          status: 'COMPLETED',
          kind: 'sale',
          source: 'webhook',
        },
        client,
      );
    }
    if (event.event_type.startsWith('PAYMENT.PAYOUTSBATCH.') && r?.batch_header?.payout_batch_id && r.batch_header.batch_status) {
      await applyPayoutStatus(r.batch_header.payout_batch_id, r.batch_header.batch_status, client);
    } else if (event.event_type.startsWith('PAYMENT.PAYOUTS-ITEM.') && r?.payout_batch_id && r.transaction_status) {
      await applyPayoutStatus(r.payout_batch_id, r.transaction_status, client);
    }
    if (event.event_type.startsWith('INVOICING.INVOICE.') && r?.invoice?.id) {
      const status = event.event_type.endsWith('.PAID') ? 'PAID' : event.event_type.endsWith('.CANCELLED') ? 'CANCELLED' : (r.invoice.status ?? 'SENT');
      await applyInvoiceStatus(r.invoice.id, status, client);
    }
    await client.query('COMMIT');
    // The vendor is paid after the response, never while PayPal (or the supporter) waits.
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && r?.id) runAfterResponse(() => settleCapture(r.id!));
    return 'processed';
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type PaidOrder = { amountCents: number; currency: string; payerFirstName: string | null; anonymous: boolean };

/** The recorded payment for a PayPal order, or null while it is still unpaid. Used by the counter to watch a QR payment. */
export async function findPaidOrder(orderId: string, q: Queryable = db()): Promise<PaidOrder | null> {
  const { rows } = await q.query<{ amount_cents: number; currency: string; payer_name: string | null; anonymous: boolean }>(
    "SELECT amount_cents, currency, payer_name, anonymous FROM payments WHERE paypal_order_id = $1 AND status = 'COMPLETED' ORDER BY id LIMIT 1",
    [orderId],
  );
  const r = rows[0];
  if (!r) return null;
  return { amountCents: r.amount_cents, currency: r.currency, payerFirstName: r.payer_name?.split(' ')[0] ?? null, anonymous: r.anonymous };
}
