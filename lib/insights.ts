// The opportunity engine: plain code, no AI. It turns the organization's own monthly history and
// the tagged calendar into facts with numbers. The AI only writes the wording around these facts,
// so the dollar amounts and dates are never invented. All money is integer cents in the org currency.
import { eventsFor } from './calendar';
import type { OrgType, Tradition } from './org';

export type MonthlyTotal = { month: string; cents: number; count?: number }; // month = 'YYYY-MM', COMPLETED payments only

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const addMonths = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + n, 1)));
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Full months only (everything before the month containing `today`). */
export function fullMonths(monthly: MonthlyTotal[], today: Date): MonthlyTotal[] {
  const current = monthKey(today);
  return monthly.filter((m) => m.month < current);
}

/** Average total for a calendar month (1-12) across the years we have. */
export function typicalMonth(monthly: MonthlyTotal[], calendarMonth: number, today: Date): number {
  const mm = String(calendarMonth).padStart(2, '0');
  return Math.round(mean(fullMonths(monthly, today).filter((m) => m.month.endsWith(`-${mm}`)).map((m) => m.cents)));
}

/** Year-over-year growth from the last 12 full months vs the 12 before. 1 when there is not enough data. */
export function growthFactor(monthly: MonthlyTotal[], today: Date): number {
  const full = fullMonths(monthly, today);
  const last = full.slice(-12).reduce((a, m) => a + m.cents, 0);
  const prev = full.slice(-24, -12).reduce((a, m) => a + m.cents, 0);
  return full.length >= 24 && prev > 0 ? last / prev : 1;
}

/** Seasonal index: how this calendar month compares with the average month (1.0 = average). */
export function seasonalIndex(monthly: MonthlyTotal[], calendarMonth: number, today: Date): number {
  const avg = mean([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => typicalMonth(monthly, m, today)));
  return avg > 0 ? typicalMonth(monthly, calendarMonth, today) / avg : 1;
}

export type YearProjection = { actualToDateCents: number; projectedCents: number; lastYearCents: number; remainingByMonth: MonthlyTotal[] };

/** Where this calendar year lands: months so far (including the current partial month) + projected rest. */
export function projectYear(monthly: MonthlyTotal[], today: Date): YearProjection {
  const year = today.getUTCFullYear();
  const growth = growthFactor(monthly, today);
  const current = monthKey(today);
  const byMonth = new Map(monthly.map((m) => [m.month, m.cents]));
  let actual = 0;
  const remaining: MonthlyTotal[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    if (key < current) actual += byMonth.get(key) ?? 0;
    else {
      // Current and future months: what history says, scaled by growth. The current month never projects below what it already has.
      const expected = Math.round(typicalMonth(monthly, m, today) * growth);
      const value = key === current ? Math.max(expected, byMonth.get(key) ?? 0) : expected;
      remaining.push({ month: key, cents: value });
    }
  }
  const lastYear = monthly.filter((m) => m.month.startsWith(`${year - 1}-`)).reduce((a, m) => a + m.cents, 0);
  const projected = actual + remaining.reduce((a, m) => a + m.cents, 0);
  return { actualToDateCents: actual, projectedCents: projected, lastYearCents: lastYear, remainingByMonth: remaining };
}

// --- Opportunities --------------------------------------------------------------------

export type EventOpportunity = {
  kind: 'event';
  id: string;
  name: string;
  start: string;
  end: string;
  daysUntilStart: number; // negative when already under way
  angle: string;
  typicalMonthCents: number; // typical total for the month the event starts in
  seasonalIndex: number;
  /** A modest estimate (7% of a typical month), shown as an estimate, not a promise. */
  estimatedUpliftCents: number;
};

export type ReservePlan = {
  kind: 'reserve';
  percent: number; // whole percent of peak-month volume to set aside
  peakMonths: number[]; // calendar months 1-12
  lowMonths: number[];
  monthlyGapCents: number; // average shortfall per low month vs the average month
  gapTotalCents: number; // total shortfall across the low months in a typical year
  coverage: number; // 0..1 share of that gap the reserve covers
  reserveCents: number; // what the percent sets aside across the peaks in a year
};

export type Opportunity = EventOpportunity | ReservePlan;

const UPLIFT = 0.07;
const dayDiff = (a: string, b: Date) => Math.round((Date.parse(a) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 86_400_000);

/** Calendar events starting soon (or under way) for this org type, with numbers from its own history. */
export function eventOpportunities(
  monthly: MonthlyTotal[], orgType: OrgType, tradition: Tradition | null, today: Date, horizonDays = 120,
): EventOpportunity[] {
  return eventsFor(orgType, tradition)
    .filter((e) => dayDiff(e.end, today) >= 0 && dayDiff(e.start, today) <= horizonDays)
    .map((e) => {
      const month = Number(e.start.slice(5, 7));
      const typical = typicalMonth(monthly, month, today);
      return {
        kind: 'event' as const, id: e.id, name: e.name, start: e.start, end: e.end,
        daysUntilStart: dayDiff(e.start, today), angle: e.angle,
        typicalMonthCents: typical, seasonalIndex: seasonalIndex(monthly, month, today),
        estimatedUpliftCents: Math.round(typical * UPLIFT),
      };
    });
}

/** Smoothing reserve: a small share of the peak months set aside to cover the low months. Null when the year is flat. */
export function reservePlan(monthly: MonthlyTotal[], today: Date): ReservePlan | null {
  const typical = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => typicalMonth(monthly, m, today));
  const avg = mean(typical);
  if (avg <= 0 || typical.some((t) => t === 0)) return null;
  const idx = typical.map((t) => t / avg);
  const peaks = idx.map((v, i) => (v >= 1.3 ? i : -1)).filter((i) => i >= 0);
  const lows = idx.map((v, i) => (v <= 0.75 ? i : -1)).filter((i) => i >= 0);
  if (!peaks.length || !lows.length) return null;
  const gapTotal = lows.reduce((a, i) => a + (avg - typical[i]), 0);
  const peakTotal = peaks.reduce((a, i) => a + typical[i], 0);
  // Never ask for more than 10% of peak giving; if that cannot cover the gap, say how much it does cover.
  const percent = Math.min(10, Math.max(1, Math.ceil((gapTotal / peakTotal) * 100)));
  const reserve = Math.round((peakTotal * percent) / 100);
  return {
    kind: 'reserve', percent,
    peakMonths: peaks.map((i) => i + 1), lowMonths: lows.map((i) => i + 1),
    monthlyGapCents: Math.round(gapTotal / lows.length), gapTotalCents: Math.round(gapTotal),
    coverage: Math.min(1, reserve / gapTotal), reserveCents: reserve,
  };
}

export { addMonths };
