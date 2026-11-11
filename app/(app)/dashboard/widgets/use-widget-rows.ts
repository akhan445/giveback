'use client';

// Fetches the rows for a custom widget's mapped fields and refetches when the fields (or Studio's
// data / filters) change. Rows are keyed by field key ('campaign.raised.sum').
import { useEffect, useState } from 'react';
import type { AgWidgetApi, AgWidgetField } from 'ag-studio';

export const keyOf = (f: AgWidgetField) => {
  const x = f as unknown as { key?: unknown; fieldId?: unknown };
  return String(x.key ?? x.fieldId);
};

export function useWidgetRows(widgetApi: AgWidgetApi, fields: (AgWidgetField | undefined)[]) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  // Studio hands over fresh field objects on every render, so key the request on their content.
  const fieldsKey = JSON.stringify(fields);
  useEffect(() => {
    const ready = fields.filter((f): f is AgWidgetField => !!f);
    if (ready.length !== fields.length) return;
    let cancelled = false;
    widgetApi.getData({ fields: ready }).then((res) => {
      if (!cancelled) setRows(res.results.rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetApi, fieldsKey]);
  return rows;
}
