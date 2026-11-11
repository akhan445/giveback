// The fundraising goal shown on the live display, and the leaderboard of who is giving toward it.
import type { Impact } from './impact';
import type { GiftRow } from './studio-data';

export type Goal = { name: string; goalCents: number; start: string | null; impact: Partial<Impact> | null }; // start: YYYY-MM-DD, null = first of this month

/** First day of the goal period as an ISO date (YYYY-MM-DD). */
export const goalStart = (g: Goal, now = new Date()) => g.start ?? `${now.toISOString().slice(0, 7)}-01`;

export type Activity = { id: string; who: string; amount: number; at: string; anonymous: boolean };

/** The latest payments, newest first, for the live feed. Anonymous gifts show as "Someone". */
export function recentActivity(
  gifts: Pick<GiftRow, 'id' | 'donor' | 'anonymous' | 'amount' | 'date'>[],
  limit = 8,
): Activity[] {
  return [...gifts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((g) => ({
      id: g.id,
      who: g.anonymous ? 'Someone' : g.donor === 'Supporter' ? 'A supporter' : g.donor,
      amount: g.amount,
      at: g.date,
      anonymous: g.anonymous,
    }));
}

/** "just now", "10 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now: number): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / 1440)} d ago`;
}
