import { describe, expect, it } from 'vitest';
import { checkCanCover } from '../chat-tools';

const monthly = [
  { month: '2025-03', cents: 1_200_000 }, { month: '2026-03', cents: 1_300_000 },
  { month: '2025-04', cents: 700_000 }, { month: '2026-04', cents: 800_000 },
];
const today = new Date('2026-11-10T12:00:00Z');

describe('check_can_cover', () => {
  it('compares an expense with expected and worst-year giving for that month', () => {
    const r = checkCanCover(monthly, 3, 320_000, today) as Record<string, unknown>;
    expect(r.covered_by_expected).toBe(true);
    expect(r.covered_even_in_worst_year).toBe(true);
    expect(r.lowest_same_month_in_history).toBe(12_000);
    expect(checkCanCover(monthly, 4, 780_000, today)).toMatchObject({ covered_even_in_worst_year: false });
  });
  it('rejects bad input and months without history', () => {
    expect(checkCanCover(monthly, 13, 100, today)).toHaveProperty('error');
    expect(checkCanCover(monthly, 3, -5, today)).toHaveProperty('error');
    expect(checkCanCover(monthly, 8, 100, today)).toHaveProperty('error');
  });
});
