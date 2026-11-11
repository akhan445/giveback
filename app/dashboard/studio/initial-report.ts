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
    'recent-payments': at(0, 23, 24, 22),
  },
};

const cashback: AgPageState = {
  id: 'cashback',
  widgets: {
    'kpi-cashback': kpi('Cashback earned', sum('months.cashback'), 'calendar::month'),
    'kpi-fees': kpi('PayPal fees', sum('months.fees'), 'calendar::month'),
    'kpi-volume': kpi('Volume', sum('months.volume'), 'calendar::month'),
    'kpi-months': kpi('Months tracked', countd('months.month')),
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
    'kpi-months': at(18, 0, 6, 7),
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
    'top-supporters': {
      type: 'bar-chart-grouped',
      dataMapping: { categoryKey: [{ id: 'gifts.donor' }], valueKey: [sum('gifts.amount')] },
      format: title('Top supporters (anonymous gifts excluded)'),
    },
    'supporter-table': {
      type: 'grid',
      dataMapping: {
        cols: [{ id: 'gifts.donor' }, countd('gifts.id'), sum('gifts.amount'), avg('gifts.amount'), sum('gifts.feeCovered')],
      },
      sort: [{ field: sum('gifts.amount'), direction: 'desc' }],
      format: title('Supporters'),
    },
  },
  widgetLayout: {
    'kpi-named': at(0, 0, 8, 7),
    'kpi-top': at(8, 0, 8, 7),
    'top-supporters': at(0, 7, 12, 20),
    'supporter-table': at(12, 7, 12, 20),
  },
  filter: {
    page: [{ field: { id: 'gifts.anonymous' }, model: { operator: 'isFalse' } }],
  },
};

// The report opens on its first page.
export const dashboardReport: AgReportState = {
  selectedPageId: money.id,
  pages: [money, cashback, supporters],
};
