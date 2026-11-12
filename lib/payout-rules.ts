// The rules for collecting cashback, as pure functions (no database, no PayPal) so they are easy to test.
//   - Manual collect: balance must reach the minimum, and one payout is allowed per cooldown period.
//   - Never two payouts at once.
export type PayoutTrigger = 'manual' | 'year_end'; // new payouts are always 'manual'; old rows may say 'year_end' (the automatic sweep was removed)

export const DEFAULT_MIN_CENTS = 1_000; // $10
export const DEFAULT_COOLDOWN_DAYS = 30;

export type PayoutCheck =
  | { ok: true }
  | { ok: false; reason: 'no_balance' | 'in_flight' | 'no_recipient' }
  | { ok: false; reason: 'below_minimum'; shortCents: number }
  | { ok: false; reason: 'cooldown'; availableAt: Date };

export function checkPayout(i: {
  trigger: PayoutTrigger;
  balanceCents: number;
  minCents: number;
  cooldownDays: number;
  lastPayoutAt: Date | null;
  inFlight: boolean;
  hasRecipient: boolean;
  now: Date;
}): PayoutCheck {
  if (!i.hasRecipient) return { ok: false, reason: 'no_recipient' };
  if (i.inFlight) return { ok: false, reason: 'in_flight' };
  if (i.balanceCents <= 0) return { ok: false, reason: 'no_balance' };
  if (i.balanceCents < i.minCents) return { ok: false, reason: 'below_minimum', shortCents: i.minCents - i.balanceCents };
  if (i.lastPayoutAt) {
    const availableAt = new Date(i.lastPayoutAt.getTime() + i.cooldownDays * 86_400_000);
    if (i.now < availableAt) return { ok: false, reason: 'cooldown', availableAt };
  }
  return { ok: true };
}

export function explainCheck(c: PayoutCheck, money: (cents: number) => string, date: (d: Date) => string): string {
  if (c.ok) return '';
  switch (c.reason) {
    case 'below_minimum': return `${money(c.shortCents)} more to reach the minimum`;
    case 'cooldown': return `Next payout available ${date(c.availableAt)}`;
    case 'in_flight': return 'A payout is already on its way';
    case 'no_balance': return 'No cashback to collect yet';
    case 'no_recipient': return 'Add a payout email in Settings';
  }
}

// PayPal statuses (batch and item) folded into one column. Failures free the amount to be collected again.
const FAILED = new Set(['FAILED', 'DENIED', 'CANCELED', 'BLOCKED', 'REFUNDED', 'REVERSED', 'RETURNED']);
const OPEN = new Set(['PENDING', 'PROCESSING', 'ONHOLD']);

export const isFailedStatus = (s: string) => FAILED.has(s);
export const isInFlightStatus = (s: string) => OPEN.has(s);

/** Folds a PayPal status into ours, never moving a finished payout backwards because events arrive out of order. */
export function nextStatus(current: string, incoming: string): string {
  const s = incoming.toUpperCase();
  if (current === 'SUCCESS') return FAILED.has(s) && s !== 'FAILED' && s !== 'DENIED' && s !== 'CANCELED' ? s : current; // money came back
  if (FAILED.has(current)) return current;
  return s;
}
