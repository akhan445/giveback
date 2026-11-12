'use client';

// Custom AG Studio widget: a plain world map where every country that gifts came from is
// highlighted (darker = more raised). Mapped to two fields (country, value), so it works on any
// table that has them, and it follows Studio's filters like the built-in widgets do.
import { useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';

const W = 800;
const H = 420;
type Country = { type: 'Feature'; properties: { name: string }; geometry: never };
const collection = feature(countries110 as never, (countries110 as never as { objects: { countries: never } }).objects.countries) as unknown as {
  type: 'FeatureCollection';
  features: Country[];
};
const projection = geoNaturalEarth1().fitSize([W, H], collection as never);
const path = geoPath(projection);
const shapes = collection.features
  .filter((f) => f.properties.name !== 'Antarctica')
  .map((f) => ({ name: f.properties.name, d: path(f as never) ?? '' }));

// Our country names that differ from the map file's names.
const ALIASES: Record<string, string> = { 'United States': 'United States of America' };

// Studio keys result rows by the field's key ('gifts.country', 'gifts.amount.sum').
const keyOf = (f: AgWidgetField) => {
  const x = f as unknown as { key?: unknown; fieldId?: unknown };
  return String(x.key ?? x.fieldId);
};

export function WorldMapWidget({ widgetApi, dataMapping }: AgWidgetParams) {
  const map = dataMapping as Record<string, AgWidgetField[] | undefined>;
  const country = map.country?.[0];
  const value = map.value?.[0];
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  // Studio hands over fresh field objects on every render, so key the request on their content.
  const fieldsKey = JSON.stringify([country, value]);

  useEffect(() => {
    if (!country || !value) return;
    let cancelled = false;
    widgetApi.getData({ fields: [country, value] }).then((res) => {
      if (!cancelled) setRows(res.results.rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetApi, fieldsKey]);

  const totals = useMemo(() => {
    const out = new Map<string, number>();
    if (!country || !value || !rows) return out;
    for (const r of rows) {
      const raw = String(r[keyOf(country)] ?? '');
      const v = Number(r[keyOf(value)]);
      if (raw && Number.isFinite(v) && v > 0) out.set(ALIASES[raw] ?? raw, (out.get(ALIASES[raw] ?? raw) ?? 0) + v);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fieldsKey]);
  if (!country || !value) return <p style={{ padding: 16 }}>Map a country and a value.</p>;
  const max = Math.max(1, ...totals.values());

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} role="img" aria-label="Map of the countries gifts come from">
      {shapes.map((s) => {
        const v = totals.get(s.name);
        return (
          <path
            key={s.name}
            d={s.d}
            fill={v ? 'var(--pp-blue)' : 'var(--pp-gridline)'}
            fillOpacity={v ? 0.35 + 0.65 * Math.sqrt(v / max) : 1}
            stroke="var(--pp-border)"
            strokeWidth={0.5}
          >
            {v ? <title>{`${s.name}: ${Math.round(v).toLocaleString()}`}</title> : <title>{s.name}</title>}
          </path>
        );
      })}
    </svg>
  );
}
