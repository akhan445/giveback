// Pure rules for sponsor invoices (no database, no PayPal), so they are easy to test.

export type SponsorInvoiceStatus = 'PENDING' | 'SENT' | 'PAID' | 'CANCELLED' | 'FAILED';

/** Maps a PayPal invoice status to ours. Anything still open counts as SENT. */
export function statusFromPayPal(paypal: string): SponsorInvoiceStatus {
  const s = paypal.toUpperCase();
  if (s === 'PAID' || s === 'MARKED_AS_PAID') return 'PAID';
  if (s === 'CANCELLED') return 'CANCELLED';
  return 'SENT';
}

/** PayPal rejects a due date in the past: use the sponsor's due date, but never earlier than today. */
export function dueDateFor(dueDate: string, now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  return dueDate < today ? today : dueDate;
}

export const decimalFromCents = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
