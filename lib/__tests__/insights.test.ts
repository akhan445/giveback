import { describe, expect, it } from 'vitest';
import { eventsFor } from '../calendar';
import { eventOpportunities, growthFactor, projectYear, reservePlan, seasonalIndex, typicalMonth, type MonthlyTotal } from '../insights';

// Two full years (2024-11 .. 2026-10) with the same seasonal shape, +10% in year two.
const SEASON = [5000, 6000, 12000, 7000, 6000, 4000, 4000, 5000, 7000, 10000, 9000, 18000];
function history(): MonthlyTotal[] {
  const out: MonthlyTotal[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(2024, 10 + i, 1));
    out.push({ month: d.toISOString().slice(0, 7), cents: Math.round(SEASON[d.getUTCMonth()] * 100 * (i < 12 ? 1 : 1.1)) });
  }
  out.push({ month: '2026-11', cents: 500_000 }); // current, partial
  return out;
}
const today = new Date('2026-11-10T12:00:00Z');

describe('insights engine', () => {
  it('averages the same calendar month across years, ignoring the current partial month', () => {
    expect(typicalMonth(history(), 12, today)).toBe(Math.round((1_800_000 + 1_980_000) / 2));
    expect(typicalMonth(history(), 11, today)).toBe(Math.round((900_000 + 990_000) / 2)); // 2026-11 excluded
  });

  it('computes growth and the seasonal index', () => {
    expect(growthFactor(history(), today)).toBeCloseTo(1.1, 2);
    expect(seasonalIndex(history(), 12, today)).toBeGreaterThan(2);
    expect(seasonalIndex(history(), 7, today)).toBeLessThan(0.7);
  });

  it('projects the year from history and never below what the current month already has', () => {
    const p = projectYear(history(), today);
    expect(p.projectedCents).toBeGreaterThan(p.actualToDateCents);
    expect(p.remainingByMonth.map((m) => m.month)).toEqual(['2026-11', '2026-12']);
    expect(p.remainingByMonth.every((m) => m.cents >= 500_000)).toBe(true);
  });

  it('only suggests events for the organization type and tradition', () => {
    const food = eventOpportunities(history(), 'food_bank', null, today).map((o) => o.id);
    expect(food).toContain('holiday-hunger-2026');
    expect(food).not.toContain('ramadan-2027');
    const mosque = eventOpportunities(history(), 'faith', 'muslim', today, 120).map((o) => o.id);
    expect(mosque).toContain('ramadan-2027');
    expect(mosque).not.toContain('advent-2026');
    const ocean = eventsFor('environment', null).map((e) => e.id);
    expect(ocean).toContain('oceans-day-2027');
    expect(ocean).not.toContain('ramadan-2027');
    expect(eventsFor('faith', null).every((e) => !e.traditions)).toBe(true);
  });

  it('gives every organization the universal events with numbers from its own history', () => {
    const o = eventOpportunities(history(), 'arts', null, today).find((e) => e.id === 'giving-tuesday-2026');
    expect(o?.daysUntilStart).toBe(21);
    expect(o?.typicalMonthCents).toBe(Math.round((1_800_000 + 1_980_000) / 2));
    expect(o?.estimatedUpliftCents).toBe(Math.round(o!.typicalMonthCents * 0.07));
  });

  it('builds a reserve plan from peaks and lows, and none for a flat year', () => {
    const plan = reservePlan(history(), today);
    expect(plan?.peakMonths).toEqual([3, 12]);
    expect(plan?.lowMonths).toEqual(expect.arrayContaining([6, 7]));
    expect(plan?.lowMonths.some((m) => m === 3 || m === 12)).toBe(false);
    expect(plan!.percent).toBeGreaterThan(0);
    expect(plan!.percent).toBeLessThanOrEqual(10);
    expect(plan!.coverage).toBeGreaterThan(0);
    expect(plan!.coverage).toBeLessThanOrEqual(1);
    const flat = history().map((m) => ({ ...m, cents: 100_000 }));
    expect(reservePlan(flat, today)).toBeNull();
  });
});
