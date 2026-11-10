// Recording payments. Two writers (the capture route and the webhook) can report the same
// payment; both go through upsertPayment, keyed by PayPal's capture id, so it is stored once.
import type { PoolClient } from 'pg';
import { db } from './db';
import { parseFeeCoverTag } from './fees';
import { decimalToCents } from './money';

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
  source: 'capture' | 'webhook' | 'seed';
};

type Queryable = Pick<PoolClient, 'query'>;

export async function upsertPayment(p: PaymentInput, q: Queryable = db()) {
  await q.query(
    `INSERT INTO payments (paypal_capture_id, paypal_order_id, amount_cents, currency, fee_cents, fee_covered_cents, status, kind, description, payer_email, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (paypal_capture_id) DO UPDATE SET
       status        = EXCLUDED.status,
       fee_cents     = GREATEST(payments.fee_cents, EXCLUDED.fee_cents),
       fee_covered_cents = GREATEST(payments.fee_covered_cents, EXCLUDED.fee_covered_cents),
       paypal_order_id = COALESCE(payments.paypal_order_id, EXCLUDED.paypal_order_id),
       description   = COALESCE(payments.description, EXCLUDED.description),
       payer_email   = COALESCE(payments.payer_email, EXCLUDED.payer_email)`,
    [p.captureId, p.orderId ?? null, p.amountCents, p.currency, p.feeCents, p.feeCoveredCents ?? 0, p.status, p.kind, p.description ?? null, p.payerEmail ?? null, p.source],
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
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && r?.id && r.amount) {
      await upsertPayment(
        {
          captureId: r.id,
          orderId: r.supplementary_data?.related_ids?.order_id,
          amountCents: decimalToCents(r.amount.value),
          currency: r.amount.currency_code,
          feeCents: decimalToCents(r.seller_receivable_breakdown?.paypal_fee?.value ?? '0'),
          feeCoveredCents: parseFeeCoverTag(r.custom_id),
          status: 'COMPLETED',
          kind: 'sale',
          source: 'webhook',
        },
        client,
      );
    }
    await client.query('COMMIT');
    return 'processed';
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
