// The cashback ledger: for one calendar year, what each month raised, what PayPal charged, what supporters
// covered and the cashback earned. Computed from payments with the tier engine in ./cashback, all in the
// organization's currency (integer cents). Nothing is stored: the numbers can always be re-derived.
import { computeCashback } from './cashback';
import { db } from './db';
import { toOrgCents } from './history';

export type LedgerMonth = {
  month: string; // YYYY-MM
  volumeCents: number;
  count: number;
  /** Admin fee = PayPal's fee + giveback's platform fee. */
  feeCents: number;
  /** giveback's own share of the admin fee (what the platform earns before cashback). */
  platformFeeCents: number;
  feeCoveredCents: number;
  cashbackCents: number;
  tier: string;
  rateBp: number;
};

export type YearTotals = {
  volumeCents: number;
  count: number;
  feeCents: number;
  platformFeeCents: number;
  feeCoveredCents: number;
  cashbackCents: number;
  /** Raised - admin fee + cashback (fees covered by supporters are already inside Raised). */
  keepCents: number;
  /** (fee - covered - cashback) / raised, in basis points. */
  effectiveFeeBp: number;
  /** Illustrative competitor: 2.9% + $0.30 per payment + 1% platform fee. */
  competitorKeepCents: number;
  /** What was saved: free money = cashback + fees supporters covered. */
  freeMoneyCents: number;
};

export function buildLedger(
  rows: { month: string; currency: string; volume: number; fee: number; pfee?: number; covered: number; n: number }[],
): LedgerMonth[] {
  const byMonth = new Map<string, Omit<LedgerMonth, 'cashbackCents' | 'tier' | 'rateBp'>>();
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { month: r.month, volumeCents: 0, count: 0, feeCents: 0, platformFeeCents: 0, feeCoveredCents: 0 };
    m.volumeCents += toOrgCents(r.volume, r.currency);
    m.feeCents += toOrgCents(r.fee, r.currency);
    m.platformFeeCents += toOrgCents(r.pfee ?? 0, r.currency);
    m.feeCoveredCents += toOrgCents(r.covered, r.currency);
    m.count += r.n;
    byMonth.set(r.month, m);
  }
  return [...byMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const c = computeCashback(m.volumeCents, m.count);
      return { ...m, cashbackCents: c.cashbackCents, tier: c.tier.name, rateBp: c.rateBp };
    });
}

/** `asOf` limits the ledger to payments up to that moment (used to reproduce what a past payout covered). */
export async function getYearLedger(year: number, asOf?: Date): Promise<LedgerMonth[]> {
  const { rows } = await db().query<{ month: string; currency: string; volume: string; fee: string; pfee: string; covered: string; n: string }>(
    `SELECT to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, currency,
            sum(amount_cents) AS volume, sum(fee_cents + platform_fee_cents + payout_fee_cents) AS fee, sum(platform_fee_cents) AS pfee, sum(fee_covered_cents) AS covered, count(*) AS n
       FROM payments
      WHERE status = 'COMPLETED' AND extract(year FROM paid_at AT TIME ZONE 'UTC') = $1
        AND ($2::timestamptz IS NULL OR paid_at <= $2)
      GROUP BY 1, 2`,
    [year, asOf ?? null],
  );
  return buildLedger(rows.map((r) => ({ month: r.month, currency: r.currency, volume: Number(r.volume), fee: Number(r.fee), pfee: Number(r.pfee), covered: Number(r.covered), n: Number(r.n) })));
}

export function yearTotals(months: LedgerMonth[], fixedFeeCents: number): YearTotals {
  const t = months.reduce(
    (a, m) => ({
      volumeCents: a.volumeCents + m.volumeCents,
      count: a.count + m.count,
      feeCents: a.feeCents + m.feeCents,
      platformFeeCents: a.platformFeeCents + m.platformFeeCents,
      feeCoveredCents: a.feeCoveredCents + m.feeCoveredCents,
      cashbackCents: a.cashbackCents + m.cashbackCents,
    }),
    { volumeCents: 0, count: 0, feeCents: 0, platformFeeCents: 0, feeCoveredCents: 0, cashbackCents: 0 },
  );
  const competitorFee = Math.round(t.volumeCents * 0.039) + t.count * fixedFeeCents;
  return {
    ...t,
    keepCents: t.volumeCents - t.feeCents + t.cashbackCents,
    effectiveFeeBp: t.volumeCents ? ((t.feeCents - t.feeCoveredCents - t.cashbackCents) / t.volumeCents) * 10_000 : 0,
    competitorKeepCents: t.volumeCents - competitorFee,
    freeMoneyCents: t.cashbackCents + t.feeCoveredCents,
  };
}
