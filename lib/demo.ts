// Sandbox demo helpers: add a month of sample activity, or reset the database to the original seed.
// Neither can touch PayPal itself: sandbox balances and transactions only change in PayPal's developer dashboard.
import { db } from './db';
import { seedPayments } from './demo-seed';
import { DEFAULT_COUNTER_TITLE } from './catalog-store';

/**
 * "A month passes": adds realistic sample payments for the current month (marked source='seed', so they are never settled
 * through PayPal) and moves earlier cashback payouts 30 days into the past, so the 30-day wait is over and the new
 * cashback can be collected again. Repeatable.
 */
export async function simulateMonth(): Promise<number> {
  const n = await seedPayments(db(), { sample: true });
  await db().query("UPDATE cashback_payouts SET created_at = created_at - interval '30 days', updated_at = now()");
  return n;
}

/** Clears payments, settlements, cashback payouts, sponsor invoices, Counter items and the saved AI chat and summary, then restores the original seed. */
export async function resetDemo(): Promise<void> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    // Children first (settlements point at payments, invoices at sponsors).
    await client.query('DELETE FROM settlements');
    await client.query('DELETE FROM cashback_payouts');
    await client.query('DELETE FROM sponsor_invoices');
    await client.query('DELETE FROM sponsors');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM chat_messages');
    await client.query('DELETE FROM ai_summaries');
    await client.query('DELETE FROM catalog_items');
    await client.query('UPDATE org_settings SET counter_title = $1, updated_at = now() WHERE id = 1', [DEFAULT_COUNTER_TITLE]);
    await seedPayments(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  // Sponsors and Counter items re-seed themselves the next time they are read.
}
