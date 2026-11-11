'use client';

// Custom AG Studio widget: a world map with one dot per place. The dot's size shows how much came
// from there. The widget is mapped to four fields (place, latitude, longitude, value), so it works
// on any table that has them, and it follows Studio's filters like the built-in widgets do.
import { useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';

const W = 800;
const H = 420;
const projection = geoNaturalEarth1().fitSize([W, H], feature(land110 as never, (land110 as never as { objects: { land: never } }).objects.land));
const landPath = geoPath(projection)(feature(land110 as never, (land110 as never as { objects: { land: never } }).objects.land)) ?? '';

type Dot = { place: string; lat: number; lon: number; value: number };

// Studio keys result rows by the field's key ('gifts.city', 'gifts.amount.sum').
const keyOf = (f: AgWidgetField) => {
  const x = f as unknown as { key?: unknown; fieldId?: unknown };
  return String(x.key ?? x.fieldId);
};

export function WorldMapWidget({ widgetApi, dataMapping }: AgWidgetParams) {
  const map = dataMapping as Record<string, AgWidgetField[] | undefined>;
  const place = map.place?.[0];
  const lat = map.latitude?.[0];
  const lon = map.longitude?.[0];
  const value = map.value?.[0];
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  // Studio hands over fresh field objects on every render, so key the request on their content.
  const fieldsKey = JSON.stringify([place, lat, lon, value]);

  useEffect(() => {
    if (!place || !lat || !lon || !value) return;
    let cancelled = false;
    widgetApi.getData({ fields: [place, lat, lon, value] }).then((res) => {
      if (!cancelled) setRows(res.results.rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetApi, fieldsKey]);

  const dots: Dot[] = useMemo(() => {
    if (!place || !lat || !lon || !value || !rows) return [];
    return rows
      .map((r) => ({ place: String(r[keyOf(place)] ?? ''), lat: Number(r[keyOf(lat)]), lon: Number(r[keyOf(lon)]), value: Number(r[keyOf(value)]) }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon) && d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fieldsKey]);
  if (!place || !lat || !lon || !value) return <p style={{ padding: 16 }}>Map a place, latitude, longitude and value.</p>;
  const max = Math.max(1, ...dots.map((d) => d.value));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} role="img" aria-label="Map of where gifts come from">
      <path d={landPath} fill="var(--pp-gridline)" stroke="var(--pp-border)" strokeWidth={0.5} />
      {dots.map((d) => {
        const p = projection([d.lon, d.lat]);
        if (!p) return null;
        const r = 6 + 20 * Math.sqrt(d.value / max);
        return (
          <g key={`${d.place}-${d.lat}-${d.lon}`}>
            <circle cx={p[0]} cy={p[1]} r={r} fill="var(--pp-blue)" opacity={0.3} />
            <circle cx={p[0]} cy={p[1]} r={4} fill="var(--pp-blue)">
              <title>{`${d.place}: ${Math.round(d.value).toLocaleString()}`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
