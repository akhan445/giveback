import { describe, expect, it } from 'vitest';
import { goalStart, leaderboard } from './campaign';

const g = (donor: string, amount: number, date: string, anonymous = false) => ({ donor, amount, date, anonymous });

describe('leaderboard', () => {
  it('ranks named supporters by total since the start date and skips anonymous gifts', () => {
    const rows = leaderboard(
      [g('Ann', 50, '2026-11-02T10:00:00Z'), g('Bo', 80, '2026-11-03T10:00:00Z'), g('Ann', 40, '2026-11-05T10:00:00Z'), g('Anonymous', 999, '2026-11-05T10:00:00Z', true), g('Cy', 500, '2026-10-31T23:00:00Z')],
      '2026-11-01',
    );
    expect(rows.map((r) => [r.rank, r.donor, r.total, r.gifts])).toEqual([[1, 'Ann', 90, 2], [2, 'Bo', 80, 1]]);
  });
  it('limits the list', () => {
    const many = Array.from({ length: 12 }, (_, i) => g(`D${i}`, i + 1, '2026-11-02T10:00:00Z'));
    expect(leaderboard(many, '2026-11-01', 5)).toHaveLength(5);
  });
});

describe('goalStart', () => {
  it('defaults to the first of the current month', () => {
    expect(goalStart({ name: 'x', goalCents: 1, start: null }, new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-01');
    expect(goalStart({ name: 'x', goalCents: 1, start: '2026-10-15' }, new Date('2026-11-10T12:00:00Z'))).toBe('2026-10-15');
  });
});
