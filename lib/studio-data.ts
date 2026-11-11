// Flat rows for the AG Studio dashboards, read from Postgres. Money is in the organization's
// currency as plain dollars (Studio formats it); the rows never carry anything private to a
// supporter beyond what the org already sees. Anonymous gifts have their name replaced here, so
// no widget (or AI agent) can reveal it by accident.
import { db } from './db';
import { computeCashback } from './cashback';
import { CATALOG } from './catalog';
import { countryName, countryRegion } from './countries';
import { toOrgCents } from './history';

export type GiftRow = {
  id: string;
  date: string; // ISO timestamp
  month: string; // first day of the month, YYYY-MM-01
  kind: 'Donation' | 'Sale';
  donor: string;
  anonymous: boolean;
  visibility: 'Named' | 'Anonymous';
  anonymousGifts: 0 | 1; // so a sum is a count of anonymous gifts
  supporterType: 'First gift' | 'Repeat' | 'Anonymous';
  country: string;
  region: string;
  city: string;
  description: string;
  currency: string;
  amount: number;
  fee: number;
  feeCovered: number;
  net: number;
};

export type MonthRow = {
  month: string; // YYYY-MM-01
  gifts: number;
  volume: number;
  fees: number;
  cashback: number;
  tier: string;
  rate: number; // fraction, e.g. 0.0055
  effectiveFeeRate: number;
};

export type ItemRow = { id: string; giftId: string; item: string; quantity: number; amount: number };

export type StudioData = { asOf: string; org: string; gifts: GiftRow[]; months: MonthRow[]; items: ItemRow[] };

const dollars = (cents: number) => Math.round(cents) / 100;

export async function getStudioData(): Promise<StudioData> {
  const [pay, org] = await Promise.all([
    db().query<{
      id: string; paid_at: Date; kind: string; payer_name: string | null; anonymous: boolean;
      description: string | null; payer_country: string | null; payer_city: string | null; currency: string; amount_cents: number; fee_cents: number; fee_covered_cents: number;
    }>(
      `SELECT paypal_capture_id AS id, paid_at, kind, payer_name, anonymous, description, payer_country, payer_city, currency, amount_cents, fee_cents, fee_covered_cents
       FROM payments WHERE status = 'COMPLETED' ORDER BY paid_at DESC`,
    ),
    db().query<{ name: string }>('SELECT name FROM org_settings WHERE id = 1'),
  ]);

  const byMonth = new Map<string, { n: number; volume: number; fees: number }>();
  const gifts: GiftRow[] = pay.rows.map((r) => {
    const at = r.paid_at.toISOString();
    const month = `${at.slice(0, 7)}-01`;
    const amount = toOrgCents(r.amount_cents, r.currency);
    const fee = toOrgCents(r.fee_cents, r.currency);
    const m = byMonth.get(month) ?? { n: 0, volume: 0, fees: 0 };
    byMonth.set(month, { n: m.n + 1, volume: m.volume + amount, fees: m.fees + fee });
    const donor = r.anonymous ? 'Anonymous' : (r.payer_name ?? 'Supporter');
    return {
      id: r.id,
      date: at,
      month,
      kind: r.kind === 'donation' ? 'Donation' : 'Sale',
      donor,
      anonymous: r.anonymous,
      visibility: r.anonymous ? 'Anonymous' : 'Named',
      anonymousGifts: r.anonymous ? 1 : 0,
      supporterType: 'Anonymous',
      country: countryName(r.payer_country),
      region: countryRegion(r.payer_country),
      city: r.payer_city ?? 'Unknown',
      description: r.description ?? '',
      currency: r.currency,
      amount: dollars(amount),
      fee: dollars(fee),
      feeCovered: dollars(toOrgCents(r.fee_covered_cents, r.currency)),
      net: dollars(amount - fee),
    };
  });

  // First gift vs repeat, by supporter name, oldest first. Anonymous gifts can't be matched.
  const seen = new Set<string>();
  for (const g of [...gifts].reverse()) {
    if (g.anonymous || g.donor === 'Supporter') continue;
    g.supporterType = seen.has(g.donor) ? 'Repeat' : 'First gift';
    seen.add(g.donor);
  }

  // Counter sales list their items ("2x Cookie box, 1x Coffee"); donations have none.
  const price = new Map<string, number>(CATALOG.map((c) => [c.name, c.priceCents]));
  const items: ItemRow[] = [];
  for (const g of gifts) {
    g.description.split(', ').forEach((part, i) => {
      const m = /^(\d+)x (.+)$/.exec(part);
      const unit = m ? price.get(m[2]) : undefined;
      if (m && unit) items.push({ id: `${g.id}-${i}`, giftId: g.id, item: m[2], quantity: Number(m[1]), amount: dollars(toOrgCents(unit * Number(m[1]), 'USD')) });
    });
  }

  const covered = new Map<string, number>();
  for (const g of gifts) covered.set(g.month, (covered.get(g.month) ?? 0) + g.feeCovered * 100);

  const months: MonthRow[] = [...byMonth]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => {
      const c = computeCashback(m.volume, m.n);
      const effective = m.volume > 0 ? (m.fees - (covered.get(month) ?? 0) - c.cashbackCents) / m.volume : 0;
      return {
        month, gifts: m.n, volume: dollars(m.volume), fees: dollars(m.fees), cashback: dollars(c.cashbackCents),
        tier: c.tier.name, rate: c.rateBp / 10_000, effectiveFeeRate: Math.round(effective * 10_000) / 10_000,
      };
    });

  return { asOf: new Date().toISOString(), org: org.rows[0]?.name ?? 'Your organization', gifts, months, items };
}
