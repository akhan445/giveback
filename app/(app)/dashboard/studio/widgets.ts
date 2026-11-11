// giveback's custom AG Studio widgets, registered next to Studio's built-in ones.
import { createWidgets } from 'ag-studio-react';
import type { AgWidgetFormParams } from 'ag-studio';
import { WorldMapWidget } from '../widgets/world-map';
import { GoalWidget, LeaderboardWidget, ThermometerWidget } from '../widgets/live-studio-widgets';

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
};
const campaignForm = (params: AgWidgetFormParams) =>
  params.createDefaults({
    dataMappingItems: [
      { key: 'raised', label: 'Raised' },
      { key: 'goal', label: 'Goal' },
      { key: 'name', label: 'Goal name' },
      { key: 'since', label: 'Started' },
    ],
  });
const icon = (path: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">${path}</svg>`;

const thermometer = {
  id: 'thermometer',
  label: 'Goal thermometer',
  icon: icon('<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/>'),
  dataMapping: campaignMapping,
  form: campaignForm,
  comp: ThermometerWidget,
  defaultSize: { width: 280, height: 420 },
  minSize: { width: 200, height: 260 },
  ai: {
    description: 'A thermometer that fills as the fundraising goal is reached, with the percentage and amounts.',
    usage: 'Use to show progress toward the current fundraising goal on the live display.',
    configuration: 'raised = sum of campaign raised, goal = sum of campaign goal, name = campaign name, since = campaign since.',
  },
};

const goalCard = {
  id: 'goalCard',
  label: 'Goal progress',
  icon: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
  dataMapping: campaignMapping,
  form: campaignForm,
  comp: GoalWidget,
  defaultSize: { width: 400, height: 220 },
  minSize: { width: 240, height: 140 },
  ai: {
    description: 'The amount raised so far as a big number with a progress bar toward the goal.',
    usage: 'Use to show the headline raised-versus-goal figure on the live display.',
    configuration: 'raised = sum of campaign raised, goal = sum of campaign goal, name = campaign name, since = campaign since.',
  },
};

const leaderboardWidget = {
  id: 'leaderboard',
  label: 'Donor leaderboard',
  icon: icon('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  dataMapping: {
    donor: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The supporter name.' },
    amount: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'What they gave (sum of amount).' },
    latest: { type: 'field', supportedRoles: ['dimension', 'numeric'], required: true, aiDescription: 'Their latest gift date (max of date), used to flag new gifts.' },
  },
  form: (params: AgWidgetFormParams) =>
    params.createDefaults({
      dataMappingItems: [
        { key: 'donor', label: 'Supporter' },
        { key: 'amount', label: 'Total given' },
        { key: 'latest', label: 'Latest gift' },
      ],
    }),
  comp: LeaderboardWidget,
  defaultSize: { width: 480, height: 420 },
  minSize: { width: 260, height: 220 },
  ai: {
    description: 'A ranked list of the top named supporters by total given, with a bar and a NEW flag on gifts from the last ten minutes.',
    usage: 'Use for a live leaderboard of top supporters. Anonymous gifts are left out.',
    configuration: 'donor = supporter, amount = sum of amount, latest = max of date.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const giveWidgets = createWidgets<any>({
  additionalTypes: [worldMap as never, thermometer as never, goalCard as never, leaderboardWidget as never],
  menu: [{ label: 'giveback', widgetIds: ['worldMap', 'thermometer', 'goalCard', 'leaderboard'] }],
});
