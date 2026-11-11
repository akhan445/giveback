// The fundraising goal shown on the live display, and the leaderboard of who is giving toward it.
import type { GiftRow } from './studio-data';

export type Goal = { name: string; goalCents: number; start: string | null }; // start: YYYY-MM-DD, null = first of this month

/** First day of the goal period as an ISO date (YYYY-MM-DD). */
export const goalStart = (g: Goal, now = new Date()) => g.start ?? `${now.toISOString().slice(0, 7)}-01`;

export type LeaderRow = { rank: number; donor: string; total: number; gifts: number; latestAt: string };

/** Named supporters (real names only) ranked by what they've given since `since` (anonymous gifts can't be ranked). */
export function leaderboard(gifts: Pick<GiftRow, 'donor' | 'anonymous' | 'amount' | 'date'>[], since: string, limit = 8): LeaderRow[] {
  const by = new Map<string, { total: number; gifts: number; latestAt: string }>();
  for (const g of gifts) {
    if (g.anonymous || g.donor === 'Supporter' || g.date.slice(0, 10) < since) continue;
    const cur = by.get(g.donor) ?? { total: 0, gifts: 0, latestAt: '' };
    by.set(g.donor, { total: cur.total + g.amount, gifts: cur.gifts + 1, latestAt: g.date > cur.latestAt ? g.date : cur.latestAt });
  }
  return [...by]
    .sort(([an, a], [bn, b]) => b.total - a.total || a.latestAt.localeCompare(b.latestAt) || an.localeCompare(bn))
    .slice(0, limit)
    .map(([donor, v], i) => ({ rank: i + 1, donor, total: Math.round(v.total * 100) / 100, gifts: v.gifts, latestAt: v.latestAt }));
}
