// Read-only breakdown the assistant can ask for. Only counts and shares (never sums), because payments come in several currencies.
import { db } from './db';

export async function paymentBreakdown(days: number) {
  const d = Number.isInteger(days) && days > 0 && days <= 730 ? days : 90;
  const where = "status = 'COMPLETED' AND paid_at > now() - ($1 || ' days')::interval";
  const [tot, kinds, places, dow] = await Promise.all([
    db().query<{ n: number; covered: number; anon: number }>(`SELECT count(*)::int n, count(*) FILTER (WHERE fee_covered_cents > 0)::int covered, count(*) FILTER (WHERE anonymous)::int anon FROM payments WHERE ${where}`, [d]),
    db().query<{ kind: string; n: number }>(`SELECT kind, count(*)::int n FROM payments WHERE ${where} GROUP BY 1`, [d]),
    db().query<{ place: string; n: number }>(`SELECT COALESCE(payer_city || ', ', '') || COALESCE(payer_country, 'unknown') AS place, count(*)::int n FROM payments WHERE ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 6`, [d]),
    db().query<{ dow: string; n: number }>(`SELECT trim(to_char(paid_at, 'Day')) AS dow, count(*)::int n FROM payments WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, [d]),
  ]);
  const t = tot.rows[0];
  const pct = (x: number) => (t.n ? Math.round((x / t.n) * 100) : 0);
  return {
    last_days: d, payments: t.n,
    share_donations_percent: pct(kinds.rows.find((k) => k.kind === 'donation')?.n ?? 0),
    share_sales_percent: pct(kinds.rows.find((k) => k.kind === 'sale')?.n ?? 0),
    share_supporters_covering_fees_percent: pct(t.covered), share_anonymous_percent: pct(t.anon),
    top_supporter_locations_by_count: places.rows.map((p) => ({ place: p.place, payments: p.n })),
    busiest_weekdays_by_count: dow.rows.slice(0, 3).map((p) => ({ weekday: p.dow, payments: p.n })),
    note: 'Counts and shares only; amounts are not summed here because supporters pay in different currencies.',
  };
}
