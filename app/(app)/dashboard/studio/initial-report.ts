// The built-in "giveback reports" report: money in, fees and cashback, and supporters, as AG Studio
// report state. Field ids ('gifts.amount') refer to the data sources in ./data.ts.

import type { AgPageState, AgReportState, AgWidgetLayoutState } from 'ag-studio';

// --- Helpers ----------------------------------------------------------------------

// Position on the canvas grid, in tracks: 24 columns wide, rows of studioCanvasRowHeight.
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({
  xTrack,
  yTrack,
  xSpan,
  ySpan,
});
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: 'sum' as const });
const avg = (id: string) => ({ id, aggregation: 'avg' as const });
const countd = (id: string) => ({ id, aggregation: 'countd' as const });

const FONT = '"DM Sans", system-ui, sans-serif';

const typography = (fontSize: number, fontWeight: 'normal' | 'bold' = 'normal') => ({
  fontFamily: FONT,
  fontSize,
  fontWeight,
  fontStyle: 'normal' as const,
});

// A KPI tile, styled the same everywhere: bold title, large value, optional sparkline along `sparklineX`.
const kpi = (text: string, value: { id: string; aggregation?: 'sum' | 'avg' | 'countd' }, sparklineX?: string) => ({
  type: 'value' as const,
  dataMapping: {
    value: [value],
    ...(sparklineX && { sparklineX: [{ id: sparklineX }] }),
  },
  format: {
    title: { enabled: true, text, typography: typography(14, 'bold') },
    caption: { enabled: true, text: '', typography: typography(0) },
    style: { typography: typography(22) },
  },
});

// --- Pages ------------------------------------------------------------------------

const money: AgPageState = {
  id: 'money',
  widgets: {
    'kpi-raised': kpi('Raised', sum('gifts.amount'), 'calendar::month'),
    'kpi-gifts': kpi('Payments', countd('gifts.id'), 'calendar::month'),
    'kpi-average': kpi('Average payment', avg('gifts.amount')),
    'kpi-net': kpi('Kept after PayPal fees', sum('gifts.net'), 'calendar::month'),
    'raised-by-month': {
      type: 'combo-chart-grouped-column-line',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: [sum('gifts.amount')],
        secondaryValueKey: [sum('gifts.fee')],
      },
      format: {
        ...title('Raised by month (columns) and PayPal fees (line)'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    'by-type': {
      type: 'donut-chart',
      dataMapping: { categoryKey: [{ id: 'gifts.kind' }], valueKey: [sum('gifts.amount')] },
      format: {
        ...title('Donations vs counter sales'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    'top-items': {
      type: 'bar-chart-grouped',
      dataMapping: { categoryKey: [{ id: 'items.item' }], valueKey: [sum('items.amount')] },
      format: title('What sold at the counter (list price)'),
    },
    'by-weekday': {
      type: 'column-chart-grouped',
      dataMapping: { categoryKey: [{ id: 'calendar::dayOfWeek' }], valueKey: [sum('gifts.amount')] },
      format: title('Raised by day of the week'),
    },
    'recent-payments': {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'gifts.date' },
          { id: 'gifts.donor' },
          { id: 'gifts.kind' },
          { id: 'gifts.description' },
          sum('gifts.amount'),
          sum('gifts.fee'),
          sum('gifts.net'),
        ],
      },
      sort: [{ field: { id: 'gifts.date' }, direction: 'desc' }],
      format: title('Payments, newest first'),
    },
  },
  widgetLayout: {
    'kpi-raised': at(0, 0, 6, 7),
    'kpi-gifts': at(6, 0, 6, 7),
    'kpi-average': at(12, 0, 6, 7),
    'kpi-net': at(18, 0, 6, 7),
    'raised-by-month': at(0, 7, 16, 16),
    'by-type': at(16, 7, 8, 16),
    'top-items': at(0, 23, 12, 14),
    'by-weekday': at(12, 23, 12, 14),
    'recent-payments': at(0, 37, 24, 22),
  },
};

const reach: AgPageState = {
  id: 'reach',
  widgets: {
    'kpi-countries': kpi('Countries', countd('gifts.country')),
    'kpi-cities': kpi('Cities', countd('gifts.city')),
    'kpi-anon': kpi('Anonymous gifts', sum('gifts.anonymousGifts')),
    'kpi-repeat': kpi('Payments', countd('gifts.id')),
    'by-country': {
      type: 'bar-chart-grouped',
      dataMapping: { categoryKey: [{ id: 'gifts.country' }], valueKey: [sum('gifts.amount')] },
      sort: [{ field: sum('gifts.amount'), direction: 'desc' }],
      format: title('Raised by country'),
    },
    'gift-map': {
      type: 'worldMap' as 'value',
      dataMapping: {
        country: [{ id: 'gifts.country' }],
        value: [sum('gifts.amount')],
      } as never,
      format: title('Where gifts come from (countries highlighted)'),
    },
    visibility: {
      type: 'donut-chart',
      dataMapping: { categoryKey: [{ id: 'gifts.visibility' }], valueKey: [sum('gifts.amount')] },
      format: {
        ...title('Named vs anonymous giving'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    returning: {
      type: 'donut-chart',
      dataMapping: { categoryKey: [{ id: 'gifts.supporterType' }], valueKey: [sum('gifts.amount')] },
      format: {
        ...title('First gifts vs repeat supporters'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    currency: {
      type: 'donut-chart',
      dataMapping: { categoryKey: [{ id: 'gifts.currency' }], valueKey: [countd('gifts.id')] },
      format: {
        ...title('Payments by currency paid in'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    'country-table': {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'gifts.country' },
          { id: 'gifts.region' },
          countd('gifts.id'),
          sum('gifts.amount'),
          avg('gifts.amount'),
          sum('gifts.anonymousGifts'),
        ],
      },
      sort: [{ field: sum('gifts.amount'), direction: 'desc' }],
      format: title('Giving by country'),
    },
  },
  widgetLayout: {
    'kpi-countries': at(0, 0, 6, 7),
    'kpi-cities': at(6, 0, 6, 7),
    'kpi-anon': at(12, 0, 6, 7),
    'kpi-repeat': at(18, 0, 6, 7),
    'by-country': at(0, 7, 9, 18),
    'gift-map': at(9, 7, 15, 18),
    visibility: at(0, 25, 8, 16),
    returning: at(8, 25, 8, 16),
    currency: at(16, 25, 8, 16),
    'country-table': at(0, 41, 24, 16),
  },
};

const cashback: AgPageState = {
  id: 'cashback',
  widgets: {
    'kpi-cashback': kpi('Cashback earned', sum('months.cashback'), 'calendar::month'),
    'kpi-fees': kpi('PayPal fees', sum('months.fees'), 'calendar::month'),
    'kpi-volume': kpi('Volume', sum('months.volume'), 'calendar::month'),
    'kpi-cover': kpi('Fees covered by supporters', { id: 'coverRate' } as never),
    'cashback-by-month': {
      type: 'combo-chart-grouped-column-line',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: [sum('months.cashback')],
        secondaryValueKey: [{ id: 'months.effectiveFeeRate', aggregation: 'avg' }],
      },
      format: {
        ...title('Cashback by month (columns) and effective fee rate after cashback (line)'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    tiers: {
      type: 'donut-chart',
      dataMapping: { categoryKey: [{ id: 'months.tier' }], valueKey: [countd('months.month')] },
      format: {
        ...title('Months by cashback tier'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    'month-table': {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'months.month' },
          { id: 'months.tier' },
          sum('months.gifts'),
          sum('months.volume'),
          sum('months.fees'),
          sum('months.cashback'),
          { id: 'months.effectiveFeeRate', aggregation: 'avg' },
        ],
      },
      sort: [{ field: { id: 'months.month' }, direction: 'desc' }],
      format: title('Month by month'),
    },
  },
  widgetLayout: {
    'kpi-cashback': at(0, 0, 6, 7),
    'kpi-fees': at(6, 0, 6, 7),
    'kpi-volume': at(12, 0, 6, 7),
    'kpi-cover': at(18, 0, 6, 7),
    'cashback-by-month': at(0, 7, 16, 16),
    tiers: at(16, 7, 8, 16),
    'month-table': at(0, 23, 24, 22),
  },
};

const supporters: AgPageState = {
  id: 'supporters',
  widgets: {
    'kpi-named': kpi('Named supporters', countd('gifts.donor')),
    'kpi-top': kpi('Largest payment', { id: 'gifts.amount', aggregation: 'max' as 'sum' }),
    'new-vs-repeat': {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: [countd('gifts.id')],
        legendKey: [{ id: 'gifts.supporterType' }],
      },
      format: {
        ...title('New and returning named supporters, by month (payments)'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    'supporter-table': {
      type: 'grid',
      dataMapping: {
        cols: [{ id: 'gifts.donor' }, { id: 'gifts.country' }, countd('gifts.id'), sum('gifts.amount'), avg('gifts.amount'), sum('gifts.feeCovered')],
      },
      sort: [{ field: sum('gifts.amount'), direction: 'desc' }],
      format: title('Named supporters, biggest first (anonymous gifts excluded)'),
    },
  },
  widgetLayout: {
    'kpi-named': at(0, 0, 12, 7),
    'kpi-top': at(12, 0, 12, 7),
    'new-vs-repeat': at(0, 7, 24, 14),
    'supporter-table': at(0, 21, 24, 26),
  },
  filter: {
    page: [{ field: { id: 'gifts.anonymous' }, model: { operator: 'isFalse' } }],
  },
};

const recurring: AgPageState = {
  id: 'recurring',
  widgets: {
    'kpi-givers': kpi('Monthly givers', countd('gifts.donor')),
    'kpi-given': kpi('Given by monthly givers', sum('gifts.amount')),
    'kpi-share': kpi('Share of all volume', { id: 'months.monthlyGiverShare', aggregation: 'avg' }),
    'by-month': {
      type: 'column-chart-grouped',
      dataMapping: { categoryKey: [{ id: 'calendar::month' }], valueKey: [sum('gifts.amount')] },
      format: title('What monthly givers gave, by month (predictable income for the forecast)'),
    },
    'giver-table': {
      type: 'grid',
      dataMapping: {
        cols: [{ id: 'gifts.donor' }, { id: 'gifts.country' }, countd('gifts.id'), sum('gifts.amount'), avg('gifts.amount')],
      },
      sort: [{ field: sum('gifts.amount'), direction: 'desc' }],
      format: title('Monthly givers, biggest first (named supporters who gave in 3 or more months)'),
    },
  },
  widgetLayout: {
    'kpi-givers': at(0, 0, 8, 7),
    'kpi-given': at(8, 0, 8, 7),
    'kpi-share': at(16, 0, 8, 7),
    'by-month': at(0, 7, 24, 14),
    'giver-table': at(0, 21, 24, 26),
  },
  filter: {
    page: [{ field: { id: 'gifts.monthlyGiver' }, model: { operator: 'isTrue' } }],
  },
};

const campaignMapping = { raised: [sum('campaign.raised')], goal: [sum('campaign.goal')], name: [{ id: 'campaign.name' }], since: [{ id: 'campaign.since' }], theme: [{ id: 'campaign.theme' }] } as never;

const live: AgPageState = {
  id: 'live',
  widgets: {
    fill: { type: 'impactFill' as 'value', dataMapping: campaignMapping, format: title('Goal') },
    grid: { type: 'impactGrid' as 'value', dataMapping: campaignMapping, format: title('Impact') },
    raised: { type: 'goalCard' as 'value', dataMapping: campaignMapping, format: title('Raised so far') },
    feed: {
      type: 'activity' as 'value',
      dataMapping: {
        id: [{ id: 'gifts.id' }],
        donor: [{ id: 'gifts.donor' }],
        amount: [{ id: 'gifts.amount' }],
        date: [{ id: 'gifts.date' }],
        anonymous: [{ id: 'gifts.anonymous' }],
      } as never,
      format: title('Latest payments'),
    },
  },
  widgetLayout: {
    fill: at(0, 0, 6, 24),
    grid: at(6, 0, 10, 24),
    raised: at(16, 0, 8, 8),
    feed: at(16, 8, 8, 16),
  },
};

// The report opens on its first page.
export const dashboardReport: AgReportState = {
  selectedPageId: money.id,
  pages: [live, money, reach, cashback, supporters, recurring],
};
