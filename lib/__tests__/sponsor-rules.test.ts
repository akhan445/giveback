import { describe, expect, it } from 'vitest';
import { decimalFromCents, dueDateFor, statusFromPayPal } from '../sponsor-rules';

describe('sponsor invoice rules', () => {
  it('maps PayPal statuses', () => {
    expect(statusFromPayPal('PAID')).toBe('PAID');
    expect(statusFromPayPal('MARKED_AS_PAID')).toBe('PAID');
    expect(statusFromPayPal('CANCELLED')).toBe('CANCELLED');
    expect(statusFromPayPal('SENT')).toBe('SENT');
    expect(statusFromPayPal('UNPAID')).toBe('SENT');
    expect(statusFromPayPal('PAYMENT_PENDING')).toBe('SENT');
  });
  it('never uses a due date in the past', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    expect(dueDateFor('2026-12-01', now)).toBe('2026-12-01');
    expect(dueDateFor('2026-10-01', now)).toBe('2026-11-12');
  });
  it('formats cents as a decimal string for PayPal', () => {
    expect(decimalFromCents(200000)).toBe('2000.00');
    expect(decimalFromCents(1205)).toBe('12.05');
    expect(decimalFromCents(5)).toBe('0.05');
  });
});
