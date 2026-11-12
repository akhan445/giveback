// Server-rendered world map for the landing page: land shapes plus a few "payment arriving" pins.
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import styles from './landing.module.css';

const W = 800;
const H = 400;
type Country = { type: 'Feature'; properties: { name: string }; geometry: never };
const collection = feature(countries110 as never, (countries110 as never as { objects: { countries: never } }).objects.countries) as unknown as {
  type: 'FeatureCollection';
  features: Country[];
};
const land = collection.features.filter((f) => f.properties.name !== 'Antarctica');
const projection = geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features: land } as never);
const path = geoPath(projection);
const shapes = land.map((f) => ({ name: f.properties.name, d: path(f as never) ?? '' }));

// [lon, lat, animation delay in seconds]
const CITIES: [string, number, number, number][] = [
  ['Toronto', -79.4, 43.7, 0],
  ['London', -0.1, 51.5, 0.6],
  ['New York', -74, 40.7, 1.1],
  ['Lagos', 3.4, 6.5, 1.7],
  ['Dubai', 55.3, 25.2, 0.3],
  ['Mumbai', 72.9, 19.1, 1.4],
  ['Singapore', 103.8, 1.35, 0.9],
  ['Sydney', 151.2, -33.9, 2.0],
  ['Sao Paulo', -46.6, -23.5, 1.9],
];
const pins = CITIES.flatMap(([name, lon, lat, delay]) => {
  const p = projection([lon, lat]);
  return p ? [{ name, x: p[0], y: p[1], delay }] : [];
});

export function LandingMap() {
  return (
    <div className={styles.map}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="World map with payments arriving from many countries">
        {shapes.map((s) => (
          <path key={s.name} d={s.d} className={styles.land} />
        ))}
        {pins.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r={7} className={styles.ring} style={{ animationDelay: `${p.delay}s` }} />
            <circle cx={p.x} cy={p.y} r={3.2} className={styles.pin} />
          </g>
        ))}
      </svg>
    </div>
  );
}
