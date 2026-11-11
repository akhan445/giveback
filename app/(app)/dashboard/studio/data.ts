// AG Studio's data sources for giveback's dashboards: gifts and months read from Postgres
// (lib/studio-data.ts), a shared calendar and a few calculated measures.

import type {
  AgDataSourcesDefinition,
  AgExpressionFieldDefinition,
  AgFieldDefinition,
  AgFormat,
  AgRelationDefinition,
} from 'ag-studio';
import type { StudioData } from '@/lib/studio-data';

// --- Helpers ----------------------------------------------------------------------

const CALENDAR_ID = 'calendar';

// [id, name, format, hide?]
type FieldSpec = [id: string, name: string, format: AgFormat, hide?: boolean];

const fields = (specs: FieldSpec[]): AgFieldDefinition[] =>
  specs.map(([id, name, format, hide]) => ({ id, name, format, ...(hide && { hide }) }));

// Foreign key 'table.field' -> primary key 'table.field'.
const manyToOne = (id: string, source: string, target: string): AgRelationDefinition => {
  const [sourceTable, sourceField] = source.split('.');
  const [targetTable, targetField] = target.split('.');
  return {
    id,
    source: { tableId: sourceTable, fieldId: sourceField },
    target: { tableId: targetTable, fieldId: targetField },
    type: 'many-to-one',
  };
};

const onCalendar = (tableId: string, fieldId: string, truncate?: 'day'): AgRelationDefinition => ({
  id: `${tableId}-${fieldId}-calendar`,
  source: { tableId, fieldId },
  target: { calendarId: CALENDAR_ID },
  ...(truncate && { truncate }),
});

const sumOf = (id: string) => ({ id, aggregation: 'sum' as const });

const ratio = (id: string, name: string, description: string, numerator: string, denominator: string): AgExpressionFieldDefinition => ({
  id,
  name,
  description,
  format: 'percentageFormat',
  isMeasure: true,
  expression: { operator: 'divide', inputs: [sumOf(numerator), sumOf(denominator)] },
});

// --- Data sources -----------------------------------------------------------------


// Whether there is anything to report on yet.
export const hasData = (data: StudioData) => data.gifts.length > 0;

export function buildStudioData(data: StudioData): AgDataSourcesDefinition {
  const dates = data.gifts.map((g) => g.date.slice(0, 10)).sort();
  const today = data.asOf.slice(0, 10);

  return {
    description:
      `Payments taken by ${data.org} through its PayPal-powered counter. Amounts are in the organization's currency (CAD). ` +
      'Gifts has one row per completed payment (a donation or a counter sale); anonymous supporters appear as "Anonymous". ' +
      'Months has one row per calendar month with the volume, PayPal fees and the volume cashback earned (simulated in the sandbox).',
    sources: [
      {
        id: 'gifts',
        description: 'One row per completed payment. Net is the amount minus PayPal fees. Fee covered is what supporters added to cover the fee.',
        data: data.gifts,
        fields: fields([
          ['id', 'Payment ID', 'textFormat', true],
          ['date', 'Date', 'dateTimeFormat'],
          ['month', 'Month', 'dateFormat', true],
          ['kind', 'Type', 'textFormat'],
          ['donor', 'Supporter', 'textFormat'],
          ['anonymous', 'Anonymous', 'booleanFormat', true],
          ['visibility', 'Named or anonymous', 'textFormat'],
          ['anonymousGifts', 'Anonymous gifts', 'integerFormat'],
          ['supporterType', 'First gift or repeat', 'textFormat'],
          ['country', 'Country', 'textFormat'],
          ['region', 'Region', 'textFormat'],
          ['city', 'City', 'textFormat'],
          ['description', 'What they bought', 'textFormat'],
          ['currency', 'Paid in', 'textFormat', true],
          ['amount', 'Amount', 'currencyFormat'],
          ['fee', 'PayPal fee', 'currencyFormat'],
          ['feeCovered', 'Fee covered by supporter', 'currencyFormat'],
          ['net', 'Net', 'currencyFormat'],
        ]),
      },
      {
        id: 'items',
        name: 'Counter items',
        description: 'One row per item line on a counter sale: the item, how many, and what they came to (list price, in the org currency).',
        data: data.items,
        fields: fields([
          ['id', 'Line ID', 'textFormat', true],
          ['giftId', 'Payment ID', 'textFormat', true],
          ['item', 'Item', 'textFormat'],
          ['quantity', 'Quantity', 'integerFormat'],
          ['amount', 'Item revenue', 'currencyFormat'],
        ]),
      },
      {
        id: 'months',
        description: 'One row per month: payment count, volume, fees, cashback earned, cashback tier and rate, and the effective fee rate after cashback.',
        data: data.months,
        fields: fields([
          ['month', 'Month', 'dateFormat'],
          ['gifts', 'Payments', 'integerFormat'],
          ['volume', 'Volume', 'currencyFormat'],
          ['fees', 'PayPal fees', 'currencyFormat'],
          ['cashback', 'Cashback', 'currencyFormat'],
          ['tier', 'Cashback tier', 'textFormat'],
          ['rate', 'Cashback rate', 'percentageFormat'],
          ['effectiveFeeRate', 'Effective fee rate', 'percentageFormat'],
        ]),
      },
    ],
    relationships: [manyToOne('item-gift', 'items.giftId', 'gifts.id'), onCalendar('gifts', 'date', 'day'), onCalendar('months', 'month')],
    calendars: [
      {
        id: CALENDAR_ID,
        label: 'Calendar',
        range: {
          from: { type: 'date', value: dates[0] ?? today },
          to: { type: 'date', value: dates.at(-1) ?? today },
        },
        fragments: ['year', 'quarter', 'month', 'week', 'day', 'dayOfWeek'],
      },
    ],
    expressions: [
      ratio('feeShare', 'Fee share', 'PayPal fees as a share of the amount raised.', 'gifts.fee', 'gifts.amount'),
      ratio('coverRate', 'Fee cover rate', 'Share of PayPal fees that supporters covered.', 'gifts.feeCovered', 'gifts.fee'),
    ],
  };
}
