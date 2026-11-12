'use client';

// Fetches the rows for a custom widget's mapped fields and refetches when the fields (or Studio's
// data / filters) change. Rows are keyed by field key ('campaign.raised.sum').
import { useEffect, useState } from 'react';
import type { AgWidgetApi, AgWidgetField } from 'ag-studio';

const REFRESH_MS = 5_000;

export const keyOf = (f: AgWidgetField) => {
  const x = f as unknown as { key?: unknown; fieldId?: unknown };
  return String(x.key ?? x.fieldId);
};

export function useWidgetRows(
  widgetApi: AgWidgetApi,
  fields: (AgWidgetField | undefined)[],
  // Newest-first ranking, done by Studio so only the top rows come back: sort by `sortDesc`, keep `limit`.
  opts?: { sortDesc?: AgWidgetField; limit?: number },
) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  // Studio hands over fresh field objects on every render, so key the request on their content.
  const fieldsKey = JSON.stringify([fields, opts]);
  useEffect(() => {
    const ready = fields.filter((f): f is AgWidgetField => !!f);
    if (ready.length !== fields.length) return;
    let cancelled = false;
    const load = () =>
      widgetApi
        .getData({
          fields: ready,
          ...(opts?.sortDesc && { sort: [{ field: opts.sortDesc, direction: 'desc' as const }] }),
          ...(opts?.limit && { limit: { count: opts.limit } }),
        })
        .then((res) => {
          if (!cancelled) setRows(res.results.rows);
        })
        .catch(() => {});
    load();
    // Studio doesn't tell custom widgets when its data changes, so re-ask every few seconds (a local query).
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetApi, fieldsKey]);
  return rows;
}
