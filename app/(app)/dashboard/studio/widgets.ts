// giveback's custom AG Studio widgets, registered next to Studio's built-in ones.
import { createWidgets } from 'ag-studio-react';
import type { AgWidgetFormParams } from 'ag-studio';
import { WorldMapWidget } from '../widgets/world-map';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const giveWidgets = createWidgets<any>({
  additionalTypes: [worldMap as never],
  menu: [{ label: 'giveback', widgetIds: ['worldMap'] }],
});
