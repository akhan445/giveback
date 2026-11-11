// Seeds realistic SANDBOX history so the dashboard has something to show: three finished months
// plus the current one, in mixed currencies. Rows are marked source='seed' and regenerated each run.
// Usage: npm run db:seed   (safe to repeat; never touches real captures/webhooks)
import { Pool } from 'pg';
import { CURRENCIES, DEFAULT_CURRENCY, convertUsdCents, type CurrencyCode } from '../lib/currency';
import { feeCoverCents } from '../lib/fees';

// Typical monthly volume by calendar month (org currency, in dollars): a food bank with a spring drive
// (Mar), a summer dip (Jun-Aug, kids out of school) and a big December. Grows ~8% a year.
const SEASON = [5500, 6500, 12400, 7700, 6200, 4500, 4300, 5700, 7700, 10400, 9400, 17600];
const GROWTH = 1.08;
const HISTORY_MONTHS = 24; // full months before the current one

// Month offsets from the current month: -24..-1 are full, 0 is "so far this month".
const MONTHS: { offset: number; targetCents: number }[] = [];
{
  const now = new Date();
  for (let offset = -HISTORY_MONTHS; offset <= 0; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const yearsBack = (-offset) / 12;
    const base = SEASON[d.getUTCMonth()] * 100 * Math.pow(GROWTH, -yearsBack);
    // Current month: only what has come in so far, kept under the next tier on purpose (demo story).
    MONTHS.push({ offset, targetCents: Math.round(offset === 0 ? 520_000 : base) });
  }
}

// Small deterministic PRNG so every run produces the same history.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const SALE_ITEMS = [
  ['Cookie box', 1200],
  ['Coffee', 350],
  ['Charity T-shirt', 2500],
  ['Raffle ticket', 500],
] as const;
const FIRST = ['Anna', 'Sam', 'Priya', 'Marcus', 'Elena', 'Tom', 'Aisha', 'Jordan', 'Mei', 'Chris', 'Fatima', 'Luca', 'Olivia', 'Daniel', 'Sofia', 'Noah', 'Amara', 'Ravi', 'Chloe', 'Omar', 'Hannah', 'Diego', 'Yuki', 'Grace', 'Ethan', 'Zara', 'Liam', 'Nadia', 'Owen', 'Isla', 'Kofi', 'Maya', 'Hugo', 'Leila', 'Finn', 'Ines', 'Arjun', 'Ruth', 'Theo', 'Salma'];
const LAST = ['Lee', 'Okafor', 'Nair', 'Webb', 'Rossi', 'Hughes', 'Khan', 'Blake', 'Tanaka', 'Dubois', 'Noor', 'Bianchi', 'Grant', 'Park', 'Alvarez', 'Murphy', 'Singh', 'Cohen', 'Silva', 'Meyer', 'Adeyemi', 'Fraser', 'Haddad', 'Novak', 'Ortiz', 'Patel', 'Quinn', 'Reyes', 'Sato', 'Turner', 'Ueda', 'Vega', 'Walsh', 'Yilmaz', 'Zhang', 'Boyd', 'Carter', 'Diaz', 'Ellis', 'Foster'];
const NAMES: string[] = FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`));
// Where supporters give from, by the currency they pay in. Most are local; USD and EUR payers come from
// many countries, which is the point of PayPal's reach. [country code, city]
const PLACES: Record<string, [string, string][]> = {
  CAD: [['CA', 'Toronto'], ['CA', 'Toronto'], ['CA', 'Calgary'], ['CA', 'Vancouver'], ['CA', 'Montreal'], ['CA', 'Ottawa'], ['CA', 'Halifax']],
  USD: [['US', 'Austin'], ['US', 'Seattle'], ['US', 'Chicago'], ['US', 'Boston'], ['US', 'New York'], ['IN', 'Mumbai'], ['PK', 'Karachi'], ['PH', 'Manila'], ['NG', 'Lagos'], ['KE', 'Nairobi'], ['MX', 'Mexico City'], ['AE', 'Dubai']],
  EUR: [['DE', 'Berlin'], ['FR', 'Lyon'], ['IE', 'Dublin'], ['NL', 'Utrecht'], ['ES', 'Valencia'], ['IT', 'Turin']],
  GBP: [['GB', 'London'], ['GB', 'Leeds'], ['GB', 'Manchester'], ['GB', 'Glasgow']],
  AUD: [['AU', 'Sydney'], ['AU', 'Melbourne'], ['NZ', 'Auckland']],
};
const CURRENCY_MIX: CurrencyCode[] = ['CAD', 'CAD', 'CAD', 'CAD', 'CAD', 'USD', 'USD', 'USD', 'EUR', 'EUR', 'GBP', 'AUD'];
const toOrgCents = (cents: number, cur: CurrencyCode) =>
  Math.round((cents / CURRENCIES[cur].rate) * CURRENCIES[DEFAULT_CURRENCY].rate);

function place(cur: string, rand: () => number) {
  const list = PLACES[cur] ?? PLACES.USD;
  const [country, city] = list[Math.floor(rand() * list.length)];
  return { country, city };
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED must be set');
  const pool = new Pool({ connectionString: url });
  const rand = rng(20261110);
  const now = new Date();
  await pool.query("DELETE FROM payments WHERE source = 'seed'");

  let n = 0;
  const rowsOut: { id: string; amount: number; fee: number; cover: number; cur: string; kind: string; desc: string; at: Date; name: string; anon: boolean; country: string; city: string }[] = [];
  for (const m of MONTHS) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m.offset, 1));
    const daysInMonth = m.offset === 0 ? Math.max(1, now.getUTCDate() - 1) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    let volume = 0;
    while (volume < m.targetCents) {
      const cur = CURRENCY_MIX[Math.floor(rand() * CURRENCY_MIX.length)];
      const isDonation = rand() < 0.35;
      let base: number;
      let description: string;
      if (isDonation) {
        base = convertUsdCents([2500, 5000, 5000, 10000, 25000][Math.floor(rand() * 5)], cur);
        description = 'Donation';
      } else {
        const lines = 1 + Math.floor(rand() * 3);
        base = 0;
        const names: string[] = [];
        for (let i = 0; i < lines; i++) {
          const [name, price] = SALE_ITEMS[Math.floor(rand() * SALE_ITEMS.length)];
          const qty = 1 + Math.floor(rand() * 2);
          base += convertUsdCents(price, cur) * qty;
          names.push(`${qty}x ${name}`);
        }
        description = names.join(', ');
      }
      // Roughly a third of supporters cover the PayPal fee.
      const cover = rand() < 0.33 ? feeCoverCents(base, cur) : 0;
      const amount = base + cover;
      const fee = Math.round((amount * 289) / 10_000) + convertUsdCents(30, cur);
      const day = 1 + Math.floor(rand() * daysInMonth);
      const paidAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 9 + Math.floor(rand() * 10), Math.floor(rand() * 60)));
      rowsOut.push({ id: `SEED-${++n}`, amount, fee, cover, cur, kind: isDonation ? 'donation' : 'sale', desc: description, at: paidAt, name: NAMES[Math.floor(rand() * NAMES.length)], anon: rand() < 0.25, ...place(cur, rand) });
      volume += toOrgCents(amount, cur);
    }
  }
  const CHUNK = 1000;
  for (let i = 0; i < rowsOut.length; i += CHUNK) {
    const c = rowsOut.slice(i, i + CHUNK);
    await pool.query(
      `INSERT INTO payments (paypal_capture_id, amount_cents, fee_cents, fee_covered_cents, currency, status, kind, description, source, paid_at, payer_name, anonymous, payer_country, payer_city)
       SELECT id, amount, fee, cover, cur, 'COMPLETED', kind, descr, 'seed', at, pname, anon, ctry, city
       FROM unnest($1::text[], $2::int[], $3::int[], $4::int[], $5::text[], $6::text[], $7::text[], $8::timestamptz[], $9::text[], $10::boolean[], $11::text[], $12::text[]) AS t(id, amount, fee, cover, cur, kind, descr, at, pname, anon, ctry, city)`,
      [c.map((r) => r.id), c.map((r) => r.amount), c.map((r) => r.fee), c.map((r) => r.cover), c.map((r) => r.cur), c.map((r) => r.kind), c.map((r) => r.desc), c.map((r) => r.at), c.map((r) => r.name), c.map((r) => r.anon), c.map((r) => r.country), c.map((r) => r.city)],
    );
  }
  const { rows } = await pool.query(
    "SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, count(*)::int AS n FROM payments GROUP BY 1 ORDER BY 1",
  );
  console.log('seeded', n, 'payments; per month:', rows.map((r) => `${r.month}=${r.n}`).join(' '));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
