// Plain-language text for opportunity cards, built from the engine's facts. This is the fallback
// (and the base the AI rewrites): it works with no AI key, and its numbers are always the engine's.
import type { EventOpportunity, ReservePlan } from './insights';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type Card = { id: string; tag: string; tone: 'green' | 'amber' | 'red'; title: string; body: string; action: string };

const when = (d: number) => (d < 0 ? 'is under way' : d === 0 ? 'is today' : d === 1 ? 'is tomorrow' : `is in ${d} days`);

export function eventCard(o: EventOpportunity, money: (c: number) => string): Card {
  const month = FULL[Number(o.start.slice(5, 7)) - 1];
  const idx = o.seasonalIndex;
  const shape =
    o.typicalMonthCents === 0 ? `We do not have a ${month} in your history yet.`
    : idx >= 1.3 ? `${month} is one of your strongest months: about ${money(o.typicalMonthCents)}, ${idx.toFixed(1)}x your average month.`
    : idx <= 0.75 ? `${month} is usually a quiet month for you (about ${money(o.typicalMonthCents)}), so a campaign can lift it.`
    : `${month} usually brings in about ${money(o.typicalMonthCents)}.`;
  const lift = o.estimatedUpliftCents > 0 ? ` A campaign could add an estimated ${money(o.estimatedUpliftCents)}.` : '';
  return {
    id: o.id, tag: 'Opportunity', tone: idx <= 0.75 ? 'amber' : 'green',
    title: `${o.name} ${when(o.daysUntilStart)}`,
    body: `${o.angle} ${shape}${lift}`,
    action: 'Draft campaign',
  };
}

export function reserveCard(r: ReservePlan, money: (c: number) => string): Card {
  const names = (ms: number[]) => ms.map((m) => MONTHS[m - 1]).join(', ');
  return {
    id: 'reserve', tag: 'Smoothing', tone: 'red',
    title: `Set aside ${r.percent}% of ${names(r.peakMonths)} to cover ${names(r.lowMonths)}`,
    body: `${names(r.lowMonths)} run about ${money(r.monthlyGapCents)} a month below your average month. ${r.percent}% of your peak months is about ${money(r.reserveCents)} a year, which covers ${Math.round(r.coverage * 100)}% of that gap.`,
    action: 'Create reserve plan',
  };
}
