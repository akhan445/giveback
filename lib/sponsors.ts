// Sponsors the AI can propose invoicing, and the PayPal invoices sent to them. The amount always comes from the
// database (the sponsor's pledge), never from the client or the model, and nothing is sent without an explicit confirm.
import type { PoolClient } from 'pg';
import { db } from './db';
import { DEFAULT_CURRENCY } from './currency';
import { getOrgProfile } from './history';
import { createInvoiceDraft, getInvoiceById, sendInvoice } from './paypal';
import { decimalFromCents, dueDateFor, statusFromPayPal, type SponsorInvoiceStatus } from './sponsor-rules';

export type SponsorRow = {
  id: number; name: string; email: string; pledgeCents: number; currency: string; dueDate: string;
  invoice: { id: number; status: SponsorInvoiceStatus; link: string | null; invoiceNumber: string | null; sentAt: string | null; paidAt: string | null } | null;
};

// The invoice goes to a sandbox personal account so the whole loop can be opened and paid in the demo.
const demoEmail = () => process.env.SPONSOR_DEMO_EMAIL || 'sb-0he9w53817163@personal.example.com';

/** Seeds three sample sponsors once (idempotent). One is already paid so the list shows every state. */
async function ensureSponsors() {
  const cur = DEFAULT_CURRENCY;
  const year = new Date().getUTCFullYear();
  await db().query(
    `INSERT INTO sponsors (name, email, pledge_cents, currency, due_date) VALUES
       ('Acme Hardware', $1, 200000, $2, $3), ('Northside Dental', $1, 150000, $2, $4), ('Rivera Family Fund', $1, 75000, $2, $5)
     ON CONFLICT (name) DO NOTHING`,
    [demoEmail(), cur, `${year}-12-01`, `${year}-12-15`, `${year}-10-30`],
  );
  await db().query(
    `INSERT INTO sponsor_invoices (sponsor_id, amount_cents, currency, status, sent_at, paid_at)
     SELECT s.id, s.pledge_cents, s.currency, 'PAID', $1::timestamptz, $1::timestamptz FROM sponsors s
      WHERE s.name = 'Rivera Family Fund' AND NOT EXISTS (SELECT 1 FROM sponsor_invoices i WHERE i.sponsor_id = s.id)`,
    [`${year}-10-30T12:00:00Z`],
  );
}

/** Asks PayPal about invoices still open (covers a webhook that is not subscribed or arrives late). */
async function refreshOpen() {
  const { rows } = await db().query<{ id: number; paypal_invoice_id: string }>(
    "SELECT id, paypal_invoice_id FROM sponsor_invoices WHERE status = 'SENT' AND paypal_invoice_id IS NOT NULL AND updated_at < now() - interval '10 seconds'",
  );
  await Promise.all(rows.map(async (r) => {
    try {
      const inv = await getInvoiceById(r.paypal_invoice_id);
      await applyInvoiceStatus(r.paypal_invoice_id, inv.status);
    } catch (e) {
      console.error('invoice refresh failed', e instanceof Error ? e.message : e);
    }
  }));
}

/** Applies a PayPal invoice status (from a webhook or a refresh). Safe to repeat. */
export async function applyInvoiceStatus(paypalInvoiceId: string, paypalStatus: string, q: Pick<PoolClient, 'query'> = db()) {
  const status = statusFromPayPal(paypalStatus);
  await q.query(
    `UPDATE sponsor_invoices SET status = $2, paid_at = CASE WHEN $2 = 'PAID' THEN COALESCE(paid_at, now()) ELSE paid_at END, updated_at = now()
      WHERE paypal_invoice_id = $1 AND status <> $2 AND status IN ('SENT', 'PENDING')`,
    [paypalInvoiceId, status],
  );
  await q.query('UPDATE sponsor_invoices SET updated_at = now() WHERE paypal_invoice_id = $1', [paypalInvoiceId]);
}

export async function listSponsors(): Promise<SponsorRow[]> {
  await ensureSponsors();
  await refreshOpen();
  const { rows } = await db().query(
    `SELECT s.id, s.name, s.email, s.pledge_cents, s.currency, to_char(s.due_date, 'YYYY-MM-DD') AS due_date,
            i.id AS inv_id, i.status, i.link, i.invoice_number, i.sent_at, i.paid_at
       FROM sponsors s
       LEFT JOIN LATERAL (SELECT * FROM sponsor_invoices WHERE sponsor_id = s.id AND status IN ('PENDING','SENT','PAID') ORDER BY id DESC LIMIT 1) i ON true
      ORDER BY s.due_date, s.id`,
  );
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, email: r.email, pledgeCents: r.pledge_cents, currency: r.currency, dueDate: r.due_date,
    invoice: r.inv_id ? { id: Number(r.inv_id), status: r.status, link: r.link, invoiceNumber: r.invoice_number, sentAt: r.sent_at?.toISOString?.() ?? null, paidAt: r.paid_at?.toISOString?.() ?? null } : null,
  }));
}

export class InvoiceError extends Error {
  constructor(public code: 'not_found' | 'already_invoiced' | 'paypal', message: string) { super(message); }
}

/** Creates and sends the PayPal invoice for a sponsor's pledge. Idempotent: one live invoice per sponsor. */
export async function sendSponsorInvoice(sponsorId: number): Promise<SponsorRow> {
  await ensureSponsors();
  const { rows } = await db().query('SELECT id, name, email, pledge_cents, currency, to_char(due_date, \'YYYY-MM-DD\') AS due_date FROM sponsors WHERE id = $1', [sponsorId]);
  const s = rows[0];
  if (!s) throw new InvoiceError('not_found', 'Unknown sponsor');

  // Reserve the slot first: the unique index makes a second click or retry fail here instead of sending twice.
  let invId: number;
  try {
    const ins = await db().query('INSERT INTO sponsor_invoices (sponsor_id, amount_cents, currency) VALUES ($1, $2, $3) RETURNING id', [s.id, s.pledge_cents, s.currency]);
    invId = Number(ins.rows[0].id);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new InvoiceError('already_invoiced', `${s.name} already has an invoice`);
    throw e;
  }

  try {
    const org = (await getOrgProfile()).name;
    const number = `GB-${new Date().getUTCFullYear()}-${String(invId).padStart(4, '0')}`;
    const paypalId = await createInvoiceDraft({
      invoiceNumber: number, currency: s.currency, amountValue: decimalFromCents(s.pledge_cents), itemName: 'Sponsorship pledge',
      note: `Thank you for sponsoring ${org}.`, dueDate: dueDateFor(s.due_date), recipientEmail: s.email, recipientName: s.name, requestId: `giveback-sponsor-${invId}`,
    });
    const link = (await sendInvoice(paypalId, `Invoice from ${org}: sponsorship pledge`)) ?? `https://www.sandbox.paypal.com/invoice/details/${paypalId}`;
    await db().query("UPDATE sponsor_invoices SET status = 'SENT', paypal_invoice_id = $2, invoice_number = $3, link = $4, sent_at = now(), updated_at = now() WHERE id = $1", [invId, paypalId, number, link]);
  } catch (e) {
    await db().query("UPDATE sponsor_invoices SET status = 'FAILED', error = $2, updated_at = now() WHERE id = $1", [invId, String(e instanceof Error ? e.message : e).slice(0, 500)]);
    throw new InvoiceError('paypal', 'PayPal could not send the invoice. Nothing was sent; try again.');
  }
  return (await listSponsors()).find((x) => x.id === sponsorId)!;
}
