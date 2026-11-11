// Read-only tools the chat assistant can call. They all read the same engine output as the
// dashboard cards, so the chat and the cards can never disagree. Nothing here moves money.
import { fullMonths, growthFactor, typicalMonth, type MonthlyTotal } from './insights';
import type { Overview } from './overview';

const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dollars = (c: number) => Math.round(c) / 100;

export const TOOL_DEFINITIONS = [
  { type: 'function', name: 'get_summary', description: 'This month so far: money raised, payments, PayPal fees, cashback earned and tier, effective fee rate, plus today.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_monthly_history', description: 'Total raised per month for all past months, oldest first.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_year_projection', description: 'Where this calendar year is projected to land, with the projected total per remaining month.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_opportunities', description: 'Upcoming calendar opportunities that fit this organization type, plus the smoothing reserve plan, with numbers from its own history.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  {
    type: 'function', name: 'check_can_cover',
    description: 'Whether expected giving in a given month would cover an expense (for example rent), based on the same month in earlier years.',
    parameters: { type: 'object', properties: { month: { type: 'integer', minimum: 1, maximum: 12 }, expense_dollars: { type: 'number', minimum: 0 } }, required: ['month', 'expense_dollars'], additionalProperties: false },
  },
] as const;

export function runTool(name: string, args: Record<string, unknown>, ov: Overview, today: Date): unknown {
  switch (name) {
    case 'get_summary':
      return {
        currency: ov.currency, month: ov.month.key,
        raised: dollars(ov.month.volumeCents), payments: ov.month.count, paypal_fees: dollars(ov.month.feeCents),
        fees_covered_by_supporters: dollars(ov.month.feeCoveredCents), cashback_earned: dollars(ov.month.cashbackCents),
        tier: ov.month.tier, cashback_rate_percent: ov.month.rateBp / 100, effective_fee_rate_percent: Number((ov.month.effectiveFeeBp / 100).toFixed(2)),
        raised_today: dollars(ov.today.volumeCents), payments_today: ov.today.count,
        next_tier: ov.tier.next ? { name: ov.tier.next.name, raise_more: dollars(ov.tier.toNextCents), extra_cashback_this_month: dollars(ov.tier.nextGainCents) } : null,
      };
    case 'get_monthly_history':
      return { currency: ov.currency, months: ov.monthly.map((m) => ({ month: m.month, raised: dollars(m.cents) })) };
    case 'get_year_projection':
      return {
        currency: ov.currency, actual_to_date_completed_months: dollars(ov.projection.actualToDateCents), projected_year_total: dollars(ov.projection.projectedCents),
        last_year_total: dollars(ov.projection.lastYearCents), growth_factor: Number(ov.growth.toFixed(3)),
        remaining_months: ov.projection.remainingByMonth.map((m) => ({ month: m.month, projected: dollars(m.cents) })),
      };
    case 'get_opportunities':
      return {
        currency: ov.currency, organization_type: ov.org.orgType,
        events: ov.opportunities.map((o) => ({ name: o.name, start: o.start, end: o.end, days_until_start: o.daysUntilStart, what_it_is: o.angle, typical_month_total: dollars(o.typicalMonthCents), index_vs_average_month: Number(o.seasonalIndex.toFixed(2)), estimated_uplift: dollars(o.estimatedUpliftCents) })),
        reserve_plan: ov.reserve && { percent_of_peak_months: ov.reserve.percent, peak_months: ov.reserve.peakMonths.map((m) => FULL[m - 1]), low_months: ov.reserve.lowMonths.map((m) => FULL[m - 1]), avg_monthly_gap: dollars(ov.reserve.monthlyGapCents), reserve_per_year: dollars(ov.reserve.reserveCents), share_of_gap_covered: Number(ov.reserve.coverage.toFixed(2)) },
      };
    case 'check_can_cover':
      return checkCanCover(ov.monthly, Number(args.month), Number(args.expense_dollars) * 100, today, ov.currency);
    default:
      return { error: `unknown tool ${name}` };
  }
}

export function checkCanCover(monthly: MonthlyTotal[], month: number, expenseCents: number, today: Date, currency = 'CAD') {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(expenseCents) || expenseCents < 0) return { error: 'month must be 1-12 and expense a non-negative number' };
  const mm = String(month).padStart(2, '0');
  const past = fullMonths(monthly, today).filter((m) => m.month.endsWith(`-${mm}`));
  if (!past.length) return { error: `no history for ${FULL[month - 1]} yet` };
  const expected = Math.round(typicalMonth(monthly, month, today) * growthFactor(monthly, today));
  const lowest = Math.min(...past.map((p) => p.cents));
  return {
    currency, month: FULL[month - 1], expense: dollars(expenseCents),
    expected_giving: dollars(expected), covered_by_expected: expected >= expenseCents, expected_surplus_or_shortfall: dollars(expected - expenseCents),
    lowest_same_month_in_history: dollars(lowest), covered_even_in_worst_year: lowest >= expenseCents,
    same_month_history: past.map((p) => ({ month: p.month, raised: dollars(p.cents) })),
    note: 'Based on giving only; does not include other cash on hand or other expenses.',
  };
}
