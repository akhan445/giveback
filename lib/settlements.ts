// Settlement: when a supporter pays the giveback PLATFORM account, the vendor is paid its share through the
// Payouts API right away: payment - PayPal's fee - payout fee - giveback's fee. What stays in the platform account is
// giveback's own fee. (Production would batch these daily; PayPal's native split needs Complete Payments approval.)
//
// This never runs on the supporter's path: the payment is saved first, the PAID screen shows, and the settlement
// runs after the response is sent (runAfterResponse). A failed payout is stored and retried later.
import { after } from 'next/server';
import { db } from './db';
import { splitPayment } from './fees';
import { createPayout } from './paypal-payouts';
import { checkoutMode } from './paypal';
import { getRecipientEmail } from './payouts';

/** Runs `fn` after the HTTP response has been sent (Vercel keeps the function alive for it). Outside a request, just runs it. */
export function runAfterResponse(fn: () => Promise<unknown>) {
  const safe = () => fn().catch((e) => console.error('settlement failed', e instanceof Error ? e.message : e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

type Row = { id: string; amount_cents: number; currency: string };

async function send(s: Row): Promise<void> {
  try {
    const recipient = await getRecipientEmail();
    if (!recipient) throw new Error('no vendor payout email');
    const batch = await createPayout({
      senderBatchId: `giveback-settle-${s.id}`,
      amountCents: s.amount_cents,
      currency: s.currency,
      receiverEmail: recipient,
      subject: 'A payment has been settled to your account',
      note: 'giveback settlement: payment received, less the admin fee.',
    });
    await db().query('UPDATE settlements SET paypal_batch_id = $2, status = $3, error = NULL, updated_at = now() WHERE id = $1', [s.id, batch.batch_header.payout_batch_id, batch.batch_header.batch_status.toUpperCase()]);
  } catch (e) {
    await db().query("UPDATE settlements SET status = 'FAILED', error = $2, updated_at = now() WHERE id = $1", [s.id, String(e instanceof Error ? e.message : e).slice(0, 500)]);
    throw e;
  }
}

/** Settles one captured payment to the vendor. Safe to call twice (capture and webhook both do): one row per payment. */
export async function settleCapture(captureId: string): Promise<void> {
  if (checkoutMode() !== 'platform') return;
  const { rows } = await db().query<{ id: string; amount_cents: number; fee_cents: number; platform_fee_cents: number; currency: string; status: string; source: string }>(
    'SELECT id, amount_cents, fee_cents, platform_fee_cents, currency, status, source FROM payments WHERE paypal_capture_id = $1',
    [captureId],
  );
  const p = rows[0];
  if (!p || p.status !== 'COMPLETED' || p.source === 'seed') return;
  const { payoutFee, vendorShare: share } = splitPayment(p.amount_cents, p.fee_cents, p.currency);
  if (share <= 0) return;
  const ins = await db().query<Row>(
    'INSERT INTO settlements (payment_id, amount_cents, currency) VALUES ($1, $2, $3) ON CONFLICT (payment_id) DO NOTHING RETURNING id, amount_cents, currency',
    [p.id, share, p.currency],
  );
  if (ins.rows[0]) {
    // Bundle the payout fee into the admin fee: stored once, with the settlement, and counted with the PayPal fees everywhere.
    await db().query('UPDATE payments SET payout_fee_cents = $2 WHERE id = $1', [p.id, payoutFee]);
    await send(ins.rows[0]);
  }
  await retryFailedSettlements();
}

/** Re-sends settlements whose PayPal call failed (same sender_batch_id, so PayPal never pays one twice). */
export async function retryFailedSettlements(): Promise<void> {
  const { rows } = await db().query<Row>(
    "SELECT id, amount_cents, currency FROM settlements WHERE status = 'FAILED' AND paypal_batch_id IS NULL AND created_at > now() - interval '3 days' ORDER BY id LIMIT 5",
  );
  for (const r of rows) await send(r).catch(() => undefined);
}
