// Everything the Overview page shows, computed on the server from Postgres. Plain code, no AI:
// the AI layer only words these facts.
import { computeCashback, effectiveFeeBp, tierProgress } from './cashback';
import { db } from './db';
import { DEFAULT_CURRENCY } from './currency';
import { getMonthlyTotals, getOrgProfile, toOrgCents } from './history';
import { eventsFor } from './calendar';
import { eventOpportunities, growthFactor, projectYear, reservePlan, typicalMonth, type MonthlyTotal } from './insights';

export async function getOverview(today = new Date()) {
  const [org, monthly] = await Promise.all([getOrgProfile(), getMonthlyTotals()]);
  const month = today.toISOString().slice(0, 7);
  const day = today.toISOString().slice(0, 10);

  // Per-currency sums for the current month and today, converted to the org currency.
  const { rows } = await db().query<{ scope: string; currency: string; volume: string; fee: string; covered: string; n: string }>(
    `SELECT 'month' AS scope, currency, sum(amount_cents) AS volume, sum(fee_cents) AS fee, sum(fee_covered_cents) AS covered, count(*) AS n
       FROM payments WHERE status = 'COMPLETED' AND to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM') = $1 GROUP BY currency
     UNION ALL
     SELECT 'today', currency, sum(amount_cents), sum(fee_cents), sum(fee_covered_cents), count(*)
       FROM payments WHERE status = 'COMPLETED' AND to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = $2 GROUP BY currency`,
    [month, day],
  );
  const sum = (scope: string) => {
    const t = { volume: 0, fee: 0, covered: 0, n: 0 };
    for (const r of rows.filter((x) => x.scope === scope)) {
      t.volume += toOrgCents(Number(r.volume), r.currency);
      t.fee += toOrgCents(Number(r.fee), r.currency);
      t.covered += toOrgCents(Number(r.covered), r.currency);
      t.n += Number(r.n);
    }
    return t;
  };
  const m = sum('month');
  const t = sum('today');
  const cashback = computeCashback(m.volume, m.n);
  const progress = tierProgress(m.volume, m.n);

  // Same month last year up to the same day of the month, so a part-finished month is compared fairly.
  const lastYearMonth = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
  const { rows: ly } = await db().query<{ currency: string; volume: string }>(
    `SELECT currency, sum(amount_cents) AS volume FROM payments
      WHERE status = 'COMPLETED' AND to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM') = $1
        AND extract(day FROM paid_at AT TIME ZONE 'UTC') <= $2 GROUP BY currency`,
    [lastYearMonth, today.getUTCDate()],
  );
  const lastYear = monthly.some((x: MonthlyTotal) => x.month === lastYearMonth) ? ly.reduce((a, r) => a + toOrgCents(Number(r.volume), r.currency), 0) : null;

  // History chart: typical month (avg of past years), this year so far, and the projection for the rest.
  const year = today.getUTCFullYear();
  const projection = projectYear(monthly, today);
  const projByMonth = new Map(projection.remainingByMonth.map((r) => [r.month, r.cents]));
  const chart = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const actual = monthly.find((x) => x.month === key)?.cents ?? null;
    return {
      month: i + 1,
      typicalCents: typicalMonth(monthly, i + 1, today),
      actualCents: key < month ? actual : null, // completed months only
      projectedCents: projByMonth.get(key) ?? null, // current + future months
      partialCents: key === month ? actual : null,
    };
  });
  // One marker per calendar month, only for events that fit this organization.
  const markers: { month: number; label: string }[] = [];
  const events = eventsFor(org.orgType, org.tradition).map((e) => ({ name: e.name, start: e.start, end: e.end }));
  for (const e of eventsFor(org.orgType, org.tradition)) {
    const mo = Number(e.start.slice(5, 7));
    if (!markers.some((x) => x.month === mo)) markers.push({ month: mo, label: e.name });
  }

  // Cashback: this month so far, the earlier months of this year, and what it works out to per payment.
  const earlier = monthly
    .filter((x) => x.month.startsWith(`${year}-`) && x.month < month)
    .map((x) => ({ month: x.month, cents: computeCashback(x.cents, x.count ?? 0).cashbackCents }));
  const cashbackSummary = {
    monthCents: cashback.cashbackCents,
    yearToDateCents: earlier.reduce((a, x) => a + x.cents, 0) + cashback.cashbackCents,
    perPaymentCents: m.n ? Math.round(cashback.cashbackCents / m.n) : 0,
    per100Cents: m.volume ? Math.round((cashback.cashbackCents / m.volume) * 10_000) : 0,
  };

  return {
    org,
    cashbackSummary,
    growth: growthFactor(monthly, today),
    chart,
    markers,
    events,
    currency: DEFAULT_CURRENCY,
    asOf: today.toISOString(),
    today: { volumeCents: t.volume, count: t.n },
    month: {
      key: month, volumeCents: m.volume, count: m.n, feeCents: m.fee, feeCoveredCents: m.covered,
      cashbackCents: cashback.cashbackCents, rateBp: cashback.rateBp, tier: cashback.tier.name,
      effectiveFeeBp: effectiveFeeBp(m.volume, m.fee, m.covered, cashback.cashbackCents),
      lastYearCents: lastYear,
    },
    tier: progress,
    monthly,
    projection,
    opportunities: eventOpportunities(monthly, org.orgType, org.tradition, today),
    reserve: reservePlan(monthly, today),
  };
}
export type Overview = Awaited<ReturnType<typeof getOverview>>;
