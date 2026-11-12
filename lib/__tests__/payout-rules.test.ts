import { describe, expect, it } from 'vitest';
import { checkPayout, isFailedStatus, isInFlightStatus, nextStatus } from '../payout-rules';

const now = new Date('2026-11-11T12:00:00Z');
const base = { trigger: 'manual', balanceCents: 44_470, minCents: 2_500, cooldownDays: 30, lastPayoutAt: null, inFlight: false, hasRecipient: true, now } as const;

describe('checkPayout', () => {
  it('allows a manual payout above the minimum with no recent payout', () => {
    expect(checkPayout(base)).toEqual({ ok: true });
  });
  it('blocks a balance below the $25 minimum and says how much is missing', () => {
    expect(checkPayout({ ...base, balanceCents: 1_200 })).toEqual({ ok: false, reason: 'below_minimum', shortCents: 1_300 });
  });
  it('allows exactly the minimum', () => {
    expect(checkPayout({ ...base, balanceCents: 2_500 })).toEqual({ ok: true });
  });
  it('blocks for 30 days after the last payout, then allows it', () => {
    const last = new Date('2026-10-20T12:00:00Z');
    const r = checkPayout({ ...base, lastPayoutAt: last });
    expect(r).toEqual({ ok: false, reason: 'cooldown', availableAt: new Date('2026-11-19T12:00:00Z') });
    expect(checkPayout({ ...base, lastPayoutAt: new Date('2026-10-12T12:00:00Z') })).toEqual({ ok: true });
  });
  it('never allows two payouts at once', () => {
    expect(checkPayout({ ...base, inFlight: true })).toEqual({ ok: false, reason: 'in_flight' });
  });
  it('needs a balance and a recipient', () => {
    expect(checkPayout({ ...base, balanceCents: 0 })).toEqual({ ok: false, reason: 'no_balance' });
    expect(checkPayout({ ...base, hasRecipient: false })).toEqual({ ok: false, reason: 'no_recipient' });
  });
});

describe('payout statuses', () => {
  it('knows which statuses are open and which free the amount again', () => {
    expect(isInFlightStatus('PENDING')).toBe(true);
    expect(isInFlightStatus('SUCCESS')).toBe(false);
    expect(isFailedStatus('FAILED')).toBe(true);
    expect(isFailedStatus('UNCLAIMED')).toBe(false); // waiting for the recipient, still counts as sent
  });
  it('moves forward, not backward, when events arrive out of order', () => {
    expect(nextStatus('PENDING', 'PROCESSING')).toBe('PROCESSING');
    expect(nextStatus('PROCESSING', 'SUCCESS')).toBe('SUCCESS');
    expect(nextStatus('SUCCESS', 'PROCESSING')).toBe('SUCCESS');
    expect(nextStatus('FAILED', 'SUCCESS')).toBe('FAILED');
    expect(nextStatus('UNCLAIMED', 'SUCCESS')).toBe('SUCCESS');
  });
  it('lets a succeeded payout be marked returned or refunded', () => {
    expect(nextStatus('SUCCESS', 'RETURNED')).toBe('RETURNED');
    expect(nextStatus('SUCCESS', 'REFUNDED')).toBe('REFUNDED');
  });
});
