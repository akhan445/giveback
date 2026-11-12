// Collecting cashback. Balance = cashback earned this calendar year (from the ledger) minus payouts already
// made for this year. Rules live in ./payout-rules; the PayPal call in ./paypal-payouts.
//
// Safety: a row is inserted (PENDING) under a database lock BEFORE PayPal is called, so two clicks can't both
// pass the checks; the row id is PayPal's sender_batch_id, so a retry can't pay twice. The amount is always
// computed here on the server, never taken from the client.
import type { PoolClient } from 'pg';
import { DEFAULT_CURRENCY, convertUsdCents } from './currency';
import { db } from './db';
import { getYearLedger, yearTotals, type LedgerMonth, type YearTotals } from './ledger';
import { createPayout, getPayoutBatch } from './paypal-payouts';
import { DEFAULT_COOLDOWN_DAYS, DEFAULT_MIN_CENTS, checkPayout, isFailedStatus, isInFlightStatus, nextStatus, type PayoutCheck, type PayoutTrigger } from './payout-rules';

const LOCK_KEY = 7_001;
const DEFAULT_RECIPIENT = 'sb-kxj6f53815421@business.example.com'; // the sandbox merchant ("giveback - merchant")

export const payoutConfig = () => ({
  minCents: Number(process.env.PAYOUT_MIN_CENTS) || DEFAULT_MIN_CENTS,
  cooldownDays: process.env.PAYOUT_COOLDOWN_DAYS !== undefined && process.env.PAYOUT_COOLDOWN_DAYS !== '' ? Number(process.env.PAYOUT_COOLDOWN_DAYS) : DEFAULT_COOLDOWN_DAYS,
});

export type PayoutRow = {
  id: number;
  year: number;
  amountCents: number;
  currency: string;
  recipientEmail: string;
  trigger: PayoutTrigger;
  status: string;
  paypalBatchId: string | null;
  error: string | null;
  createdAt: string;
};

type Raw = { id: string; year: number; amount_cents: number; currency: string; recipient_email: string; trigger: PayoutTrigger; status: string; paypal_batch_id: string | null; error: string | null; created_at: Date };
const toRow = (r: Raw): PayoutRow => ({
  id: Number(r.id), year: r.year, amountCents: r.amount_cents, currency: r.currency, recipientEmail: r.recipient_email,
  trigger: r.trigger, status: r.status, paypalBatchId: r.paypal_batch_id, error: r.error, createdAt: r.created_at.toISOString(),
});
const COLS = 'id, year, amount_cents, currency, recipient_email, trigger, status, paypal_batch_id, error, created_at';

export async function getRecipientEmail(): Promise<string | null> {
  const { rows } = await db().query<{ payout_email: string | null }>('SELECT payout_email FROM org_settings WHERE id = 1');
  return rows[0]?.payout_email || process.env.PAYOUT_RECIPIENT_EMAIL || DEFAULT_RECIPIENT;
}

export async function listPayouts(): Promise<PayoutRow[]> {
  const { rows } = await db().query<Raw>(`SELECT ${COLS} FROM cashback_payouts ORDER BY id DESC LIMIT 50`);
  return rows.map(toRow);
}

export type CashbackAccount = {
  year: number;
  currency: string;
  months: LedgerMonth[];
  totals: YearTotals;
  paidCents: number;
  balanceCents: number;
  recipientEmail: string | null;
  payouts: PayoutRow[];
  lastPayoutAt: string | null;
  inFlight: boolean;
  check: PayoutCheck;
  minCents: number;
  cooldownDays: number;
};

export async function getCashbackAccount(now = new Date()): Promise<CashbackAccount> {
  const year = now.getUTCFullYear();
  await refreshOpenPayouts();
  const [months, payouts, recipientEmail] = await Promise.all([getYearLedger(year), listPayouts(), getRecipientEmail()]);
  const totals = yearTotals(months, convertUsdCents(30, DEFAULT_CURRENCY));
  const live = payouts.filter((p) => !isFailedStatus(p.status));
  const paidCents = live.filter((p) => p.year === year).reduce((a, p) => a + p.amountCents, 0);
  const balanceCents = Math.max(0, totals.cashbackCents - paidCents);
  const last = live[0] ? new Date(live[0].createdAt) : null;
  const inFlight = payouts.some((p) => isInFlightStatus(p.status));
  const { minCents, cooldownDays } = payoutConfig();
  const common = { balanceCents, minCents, cooldownDays, lastPayoutAt: last, inFlight, hasRecipient: !!recipientEmail, now };
  return {
    year, currency: DEFAULT_CURRENCY, months, totals, paidCents, balanceCents, recipientEmail, payouts,
    lastPayoutAt: last?.toISOString() ?? null, inFlight,
    check: checkPayout({ ...common, trigger: 'manual' }),
    minCents, cooldownDays,
  };
}

export class PayoutBlockedError extends Error {
  constructor(readonly check: Extract<PayoutCheck, { ok: false }>) {
    super(`payout blocked: ${check.reason}`);
  }
}

/** Runs the checks, records the payout, then sends it through PayPal Payouts. Returns the saved row. */
export async function requestPayout(trigger: PayoutTrigger = 'manual', now = new Date()): Promise<PayoutRow> {
  const client = await db().connect();
  let row: PayoutRow;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const acct = await getCashbackAccount(now); // reads through the pool; the lock keeps other requests out until we commit
    const check = acct.check;
    if (!check.ok) throw new PayoutBlockedError(check);
    const { rows } = await client.query<Raw>(
      `INSERT INTO cashback_payouts (year, amount_cents, currency, recipient_email, trigger) VALUES ($1,$2,$3,$4,$5) RETURNING ${COLS}`,
      [acct.year, acct.balanceCents, acct.currency, acct.recipientEmail, trigger],
    );
    row = toRow(rows[0]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  try {
    const batch = await createPayout({
      senderBatchId: `giveback-payout-${row.id}`,
      amountCents: row.amountCents,
      currency: row.currency,
      receiverEmail: row.recipientEmail,
      subject: 'Your giveback cashback has arrived',
      note: `giveback cashback for ${row.year}. Thank you for raising money with giveback.`,
    });
    const { rows } = await db().query<Raw>(
      `UPDATE cashback_payouts SET paypal_batch_id = $2, status = $3, updated_at = now() WHERE id = $1 RETURNING ${COLS}`,
      [row.id, batch.batch_header.payout_batch_id, batch.batch_header.batch_status.toUpperCase()],
    );
    return toRow(rows[0]);
  } catch (e) {
    await db().query("UPDATE cashback_payouts SET status = 'FAILED', error = $2, updated_at = now() WHERE id = $1", [row.id, String(e instanceof Error ? e.message : e).slice(0, 500)]);
    throw e;
  }
}

type Queryable = Pick<PoolClient, 'query'>;

/** Applies a PayPal status (from a webhook or a poll) to the payout with this batch id. */
export async function applyPayoutStatus(batchId: string, incoming: string, q: Queryable = db()): Promise<void> {
  // The batch is either a cashback payout or a settlement to the vendor; both live in their own table.
  for (const table of ['cashback_payouts', 'settlements'] as const) {
    const { rows } = await q.query<{ id: string; status: string }>(`SELECT id, status FROM ${table} WHERE paypal_batch_id = $1`, [batchId]);
    const cur = rows[0];
    if (!cur) continue;
    const next = nextStatus(cur.status, incoming);
    if (next !== cur.status) await q.query(`UPDATE ${table} SET status = $2, updated_at = now() WHERE id = $1`, [cur.id, next]);
    return;
  }
}

/** Asks PayPal about payouts still in progress. A fallback for when a webhook is late or missed. */
export async function refreshOpenPayouts(): Promise<void> {
  const { rows } = await db().query<{ paypal_batch_id: string }>(
    "SELECT paypal_batch_id FROM cashback_payouts WHERE paypal_batch_id IS NOT NULL AND status IN ('PENDING','PROCESSING','ONHOLD')",
  );
  for (const r of rows) {
    try {
      const b = await getPayoutBatch(r.paypal_batch_id);
      await applyPayoutStatus(r.paypal_batch_id, b.batch_header.batch_status);
    } catch {
      // PayPal unreachable: keep the old status, try again next time.
    }
  }
}

export async function getPayout(id: number): Promise<PayoutRow | null> {
  const { rows } = await db().query<Raw>(`SELECT ${COLS} FROM cashback_payouts WHERE id = $1`, [id]);
  return rows[0] ? toRow(rows[0]) : null;
}

/** What one payout settled: the year's cashback up to that moment, less the payouts made before it. */
export async function getPayoutStatement(p: PayoutRow) {
  const months = await getYearLedger(p.year, new Date(p.createdAt));
  const earnedCents = months.reduce((a, m) => a + m.cashbackCents, 0);
  const { rows } = await db().query<{ sum: string | null }>(
    "SELECT sum(amount_cents) AS sum FROM cashback_payouts WHERE year = $1 AND id < $2 AND status NOT IN ('FAILED','DENIED','CANCELED','BLOCKED','REFUNDED','REVERSED','RETURNED')",
    [p.year, p.id],
  );
  const earlierCents = Number(rows[0]?.sum ?? 0);
  return { months, earnedCents, earlierCents, adjustmentCents: p.amountCents - (earnedCents - earlierCents) };
}
