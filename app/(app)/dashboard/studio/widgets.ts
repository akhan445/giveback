// giveback's custom AG Studio widgets, registered next to Studio's built-in ones.
import { createWidgets } from 'ag-studio-react';
import type { AgWidgetFormParams } from 'ag-studio';
import { WorldMapWidget } from '../widgets/world-map';

const worldMap = {
  id: 'worldMap',
  label: 'World map',
  icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  dataMapping: {
    place: { type: 'field', supportedRoles: ['dimension'], required: true, aiDescription: 'The place each dot stands for, such as a city.' },
    latitude: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'Latitude of the place, one value per place (use the average).' },
    longitude: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'Longitude of the place, one value per place (use the average).' },
    value: { type: 'field', supportedRoles: ['numeric'], required: true, aiDescription: 'What sizes the dot, such as the amount raised there.' },
  },
  form: (params: AgWidgetFormParams) =>
    params.createDefaults({
      dataMappingItems: [
        { key: 'place', label: 'Place' },
        { key: 'latitude', label: 'Latitude' },
        { key: 'longitude', label: 'Longitude' },
        { key: 'value', label: 'Dot size' },
      ],
    }),
  comp: WorldMapWidget,
  defaultSize: { width: 800, height: 420 },
  minSize: { width: 320, height: 200 },
  ai: {
    description: 'A world map with one dot per place; the dot grows with the value. Shows where supporters give from.',
    usage: 'Use for questions about where gifts or supporters come from geographically. Not for time trends.',
    configuration: 'place = city or country, latitude and longitude = average of the coordinate fields, value = sum of the amount.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const giveWidgets = createWidgets<any>({
  additionalTypes: [worldMap as never],
  menu: [{ label: 'giveback', widgetIds: ['worldMap'] }],
});
