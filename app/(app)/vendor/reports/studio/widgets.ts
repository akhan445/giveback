// giveback's custom AG Studio widgets, registered next to Studio's built-in ones.
import { createWidgets } from 'ag-studio-react';
import type { AgWidgetFormParams } from 'ag-studio';
import { WorldMapWidget } from '../widgets/world-map';
import { ActivityWidget, GoalWidget, ImpactFillWidget, ImpactGridWidget } from '../widgets/live-studio-widgets';

const worldMap = {
  id: 'worldMap',
  label: 'World map',
  icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  dataMapping: {
    country: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The country each highlighted shape stands for.' },
    value: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'What shades the country, such as the amount raised there.' },
  },
  form: (params: AgWidgetFormParams) =>
    params.createDefaults({
      dataMappingItems: [
        { key: 'country', label: 'Country' },
        { key: 'value', label: 'Shade by' },
      ],
    }),
  comp: WorldMapWidget,
  defaultSize: { width: 800, height: 420 },
  minSize: { width: 320, height: 200 },
  ai: {
    description: 'A world map that highlights every country with gifts; a darker shade means more raised. Shows where supporters give from.',
    usage: 'Use for questions about which countries gifts or supporters come from. Not for time trends.',
    configuration: 'country = the country dimension, value = sum of the amount.',
  },
};

const campaignMapping = {
  raised: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'Amount raised toward the goal (sum of campaign raised).' },
  goal: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'The fundraising goal (sum of campaign goal).' },
  name: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The goal name.' },
  since: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The date the goal period started.' },
  impact: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The impact settings (picture, grid icon, unit and cost per unit); set in Settings.' },
};
const campaignForm = (params: AgWidgetFormParams) =>
  params.createDefaults({
    dataMappingItems: [
      { key: 'raised', label: 'Raised' },
      { key: 'goal', label: 'Goal' },
      { key: 'name', label: 'Goal name' },
      { key: 'since', label: 'Started' },
      { key: 'impact', label: 'Impact settings' },
    ],
  });
const campaignAi = 'raised = sum of campaign raised, goal = sum of campaign goal, name = campaign name, since = campaign since, impact = campaign impact.';
const icon = (path: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">${path}</svg>`;

const impactFill = {
  id: 'impactFill',
  label: 'Goal fill picture',
  icon: icon('<path d="M3 11h18c0 5-3.5 8-9 8s-9-3-9-8Z"/>'),
  dataMapping: campaignMapping,
  form: campaignForm,
  comp: ImpactFillWidget,
  defaultSize: { width: 280, height: 420 },
  minSize: { width: 200, height: 260 },
  ai: {
    description: 'A picture that fills up as the fundraising goal is reached: a bowl for a food bank, a tree for an environment group, a paw for animal rescue, and so on.',
    usage: 'Use to show progress toward the current fundraising goal on the live display.',
    configuration: campaignAi,
  },
};

const impactGrid = {
  id: 'impactGrid',
  label: 'Impact milestone grid',
  icon: icon('<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'),
  dataMapping: campaignMapping,
  form: campaignForm,
  comp: ImpactGridWidget,
  defaultSize: { width: 560, height: 420 },
  minSize: { width: 300, height: 240 },
  ai: {
    description: 'A grid of plates (or trees, paws, hearts...) that lights up from the bottom-left as the goal is reached, with the count of meals served (or trees planted, animals cared for...).',
    usage: 'Use to show what the money raised has done in real-world units.',
    configuration: campaignAi,
  },
};

const goalCard = {
  id: 'goalCard',
  label: 'Raised so far',
  icon: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
  dataMapping: campaignMapping,
  form: campaignForm,
  comp: GoalWidget,
  defaultSize: { width: 400, height: 200 },
  minSize: { width: 240, height: 140 },
  ai: {
    description: 'The amount raised so far as a big number with a progress bar toward the goal.',
    usage: 'Use to show the headline raised-versus-goal figure on the live display.',
    configuration: campaignAi,
  },
};

const activity = {
  id: 'activity',
  label: 'Live payments feed',
  icon: icon('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  dataMapping: {
    id: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'Payment ID, so each payment is its own row (no aggregation).' },
    donor: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The supporter name.' },
    amount: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'The payment amount (no aggregation).' },
    date: { type: 'field', supportedRoles: ['dimension', 'numeric'], required: true, aiDescription: 'When the payment was made.' },
    anonymous: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'Whether the supporter is anonymous.' },
  },
  form: (params: AgWidgetFormParams) =>
    params.createDefaults({
      dataMappingItems: [
        { key: 'id', label: 'Payment' },
        { key: 'donor', label: 'Supporter' },
        { key: 'amount', label: 'Amount' },
        { key: 'date', label: 'When' },
        { key: 'anonymous', label: 'Anonymous' },
      ],
    }),
  comp: ActivityWidget,
  defaultSize: { width: 400, height: 420 },
  minSize: { width: 260, height: 220 },
  ai: {
    description: 'A live feed of the latest payments: "William paid $25, just now", "Sarah paid $40, 10 min ago". Anonymous supporters show as Anonymous.',
    usage: 'Use for a live view of payments as they come in.',
    configuration: 'id = payment id, donor = supporter, amount = amount, date = date, anonymous = anonymous. No aggregation.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const giveWidgets = createWidgets<any>({
  additionalTypes: [worldMap as never, impactFill as never, impactGrid as never, goalCard as never, activity as never],
});
