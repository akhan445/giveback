import { describe, expect, it } from 'vitest';
import { goalStart, recentActivity, timeAgo } from './campaign';

const g = (id: string, donor: string, amount: number, date: string, anonymous = false) => ({ id, donor, amount, date, anonymous });

describe('recentActivity', () => {
  it('lists the newest payments first and shows anonymous or unnamed ones as Anonymous', () => {
    const rows = recentActivity([
      g('1', 'Ann', 50, '2026-11-02T10:00:00Z'),
      g('2', 'Bo', 80, '2026-11-03T10:00:00Z'),
      g('3', 'Zed', 10, '2026-11-04T10:00:00Z', true),
      g('4', 'Supporter', 5, '2026-11-01T10:00:00Z'),
    ]);
    expect(rows.map((r) => r.who)).toEqual(['Anonymous', 'Bo', 'Ann', 'Anonymous']);
  });
  it('limits the list', () => {
    const many = Array.from({ length: 12 }, (_, i) => g(String(i), `D${i}`, 1, `2026-11-02T10:${String(i).padStart(2, '0')}:00Z`));
    expect(recentActivity(many, 5)).toHaveLength(5);
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  it('reads naturally', () => {
    expect(timeAgo('2026-11-10T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-10T11:50:00Z', now)).toBe('10 min ago');
    expect(timeAgo('2026-11-10T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-08T12:00:00Z', now)).toBe('2 d ago');
  });
});

describe('goalStart', () => {
  it('defaults to the first of the current month', () => {
    expect(goalStart({ name: 'x', goalCents: 1, start: null, impact: null }, new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-01');
    expect(goalStart({ name: 'x', goalCents: 1, start: '2026-10-15', impact: null }, new Date('2026-11-10T12:00:00Z'))).toBe('2026-10-15');
  });
});
