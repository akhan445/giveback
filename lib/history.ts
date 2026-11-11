// Reads the organization's money history and profile from Postgres. Everything is converted to
// the organization's currency with the simulated rates in ./currency, in integer cents.
import { db } from './db';
import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from './currency';
import { ORG_TYPE_KEYS, TRADITION_KEYS, type OrgProfile } from './org';
import type { MonthlyTotal } from './insights';
import type { Goal } from './campaign';
import { CELL_SHAPES, HERO_SHAPES, type Impact } from './impact';

export const toOrgCents = (cents: number, cur: string): number => {
  const rate = CURRENCIES[cur as CurrencyCode]?.rate ?? 1;
  return Math.round((cents / rate) * CURRENCIES[DEFAULT_CURRENCY].rate);
};

/** Completed payments per month (amount in the org currency, and how many payments). Oldest first. */
export async function getMonthlyTotals(): Promise<MonthlyTotal[]> {
  const { rows } = await db().query<{ month: string; currency: string; cents: string; n: string }>(
    `SELECT to_char(date_trunc('month', paid_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, currency, sum(amount_cents) AS cents, count(*) AS n
     FROM payments WHERE status = 'COMPLETED' GROUP BY 1, 2 ORDER BY 1`,
  );
  const byMonth = new Map<string, { cents: number; count: number }>();
  for (const r of rows) {
    const cur = byMonth.get(r.month) ?? { cents: 0, count: 0 };
    byMonth.set(r.month, { cents: cur.cents + toOrgCents(Number(r.cents), r.currency), count: cur.count + Number(r.n) });
  }
  return [...byMonth].map(([month, v]) => ({ month, cents: v.cents, count: v.count }));
}

export async function getOrgProfile(): Promise<OrgProfile> {
  const { rows } = await db().query<{ name: string; org_type: string; tradition: string | null }>(
    'SELECT name, org_type, tradition FROM org_settings WHERE id = 1',
  );
  const r = rows[0];
  const orgType = ORG_TYPE_KEYS.find((k) => k === r?.org_type) ?? 'other';
  const tradition = TRADITION_KEYS.find((k) => k === r?.tradition) ?? null;
  return { name: r?.name ?? 'Your organization', orgType, tradition: orgType === 'faith' ? tradition : null };
}

export async function saveOrgProfile(p: OrgProfile): Promise<void> {
  await db().query(
    `INSERT INTO org_settings (id, name, org_type, tradition, updated_at) VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET name = $1, org_type = $2, tradition = $3, updated_at = now()`,
    [p.name, p.orgType, p.orgType === 'faith' ? p.tradition : null],
  );
}

export async function getGoal(): Promise<Goal> {
  const { rows } = await db().query<{
    goal_name: string; goal_cents: number; goal_start: string | null;
    impact_hero: string | null; impact_cell: string | null; impact_unit: string | null; impact_done: string | null; impact_unit_cents: number | null;
  }>(
    `SELECT goal_name, goal_cents, to_char(goal_start, 'YYYY-MM-DD') AS goal_start,
            impact_hero, impact_cell, impact_unit, impact_done, impact_unit_cents
     FROM org_settings WHERE id = 1`,
  );
  const r = rows[0];
  const set = r && (r.impact_hero || r.impact_cell || r.impact_unit || r.impact_done || r.impact_unit_cents);
  const impact = set
    ? resolvePartial({ hero: r.impact_hero, cell: r.impact_cell, unit: r.impact_unit, done: r.impact_done, unitCents: r.impact_unit_cents })
    : null;
  return { name: r?.goal_name ?? 'Fundraising goal', goalCents: r?.goal_cents ?? 800_000, start: r?.goal_start ?? null, impact };
}

// Keep only the parts the organization actually set (and that are valid), so defaults still apply to the rest.
function resolvePartial(v: { hero: string | null; cell: string | null; unit: string | null; done: string | null; unitCents: number | null }): Partial<Impact> {
  const out: Partial<Impact> = {};
  if (v.hero && v.hero in HERO_SHAPES) out.hero = v.hero as Impact['hero'];
  if (v.cell && v.cell in CELL_SHAPES) out.cell = v.cell as Impact['cell'];
  if (v.unit) out.unit = v.unit;
  if (v.done) out.done = v.done;
  if (v.unitCents) out.unitCents = v.unitCents;
  return out;
}

export async function saveGoal(g: Goal): Promise<void> {
  const i = g.impact;
  await db().query(
    `INSERT INTO org_settings (id, goal_name, goal_cents, goal_start, impact_hero, impact_cell, impact_unit, impact_done, impact_unit_cents, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (id) DO UPDATE SET goal_name = $1, goal_cents = $2, goal_start = $3,
       impact_hero = $4, impact_cell = $5, impact_unit = $6, impact_done = $7, impact_unit_cents = $8, updated_at = now()`,
    [g.name, g.goalCents, g.start, i?.hero ?? null, i?.cell ?? null, i?.unit ?? null, i?.done ?? null, i?.unitCents ?? null],
  );
}
