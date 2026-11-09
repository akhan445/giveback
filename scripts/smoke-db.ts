// End-to-end DB check against the real database: payment upsert and webhook dedupe are idempotent.
// Usage: npm run db:smoke   (cleans up its own rows)
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import { handleWebhookEvent, upsertPayment } from '../lib/payments';

async function main() {
  const tag = `SMOKE-${Date.now()}`;
  const pool = db();
  try {
    const base = { orderId: `${tag}-O`, amountCents: 1200, feeCents: 0, status: 'COMPLETED', kind: 'sale' as const };
    // Same capture reported by the capture route, then twice by webhook: one row.
    await upsertPayment({ ...base, captureId: `${tag}-C`, source: 'capture' });
    const event = {
      id: `${tag}-E`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: `${tag}-C`, amount: { value: '12.00' }, seller_receivable_breakdown: { paypal_fee: { value: '0.65' } } },
    };
    assert.equal(await handleWebhookEvent(event), 'processed');
    assert.equal(await handleWebhookEvent(event), 'duplicate');

    const { rows } = await pool.query('SELECT amount_cents, fee_cents FROM payments WHERE paypal_capture_id = $1', [`${tag}-C`]);
    assert.equal(rows.length, 1, 'one payment row');
    assert.deepEqual(rows[0], { amount_cents: 1200, fee_cents: 65 });
    const ev = await pool.query('SELECT 1 FROM webhook_events WHERE event_id = $1', [`${tag}-E`]);
    assert.equal(ev.rowCount, 1, 'one webhook event row');
    console.log('OK: payment stored once (fee filled in by webhook); duplicate webhook ignored');
  } finally {
    await pool.query('DELETE FROM payments WHERE paypal_capture_id LIKE $1', [`${tag}%`]);
    await pool.query('DELETE FROM webhook_events WHERE event_id LIKE $1', [`${tag}%`]);
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
