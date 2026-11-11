'use client';

// AG Studio wrappers for the live-display views. Each reads the fields it is mapped to (so it follows
// Studio's data and filters) and hands plain values to the shared components in ./live-widgets.
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import { recentActivity } from '@/lib/campaign';
import { parseImpact } from '@/lib/impact';
import { ActivityFeed, GoalCard, ImpactFill, ImpactGrid, themeClass } from './live-widgets';
import { keyOf, useWidgetRows } from './use-widget-rows';

type Mapping = Record<string, AgWidgetField[] | undefined>;
const Missing = ({ what }: { what: string }) => <p style={{ padding: 16 }}>Map {what}.</p>;

function useCampaign({ widgetApi, dataMapping }: AgWidgetParams) {
  const m = dataMapping as Mapping;
  const raised = m.raised?.[0];
  const goal = m.goal?.[0];
  const name = m.name?.[0];
  const since = m.since?.[0];
  const impact = m.impact?.[0];
  const rows = useWidgetRows(widgetApi, [raised, goal, name, since, impact]);
  if (!raised || !goal || !name || !since || !impact) return { missing: true as const };
  const r = rows?.[0];
  return {
    missing: false as const,
    raised: Number(r?.[keyOf(raised)] ?? 0),
    goal: Number(r?.[keyOf(goal)] ?? 0),
    name: String(r?.[keyOf(name)] ?? ''),
    since: String(r?.[keyOf(since)] ?? '').slice(0, 10),
    impact: parseImpact(String(r?.[keyOf(impact)] ?? '')),
  };
}

const WHAT = 'raised, goal, name, start and impact settings';
const Themed = ({ children }: { children: React.ReactNode }) => <div className={themeClass} style={{ height: '100%' }}>{children}</div>;

export function ImpactFillWidget(p: AgWidgetParams) {
  const c = useCampaign(p);
  if (c.missing) return <Missing what={WHAT} />;
  return <Themed><ImpactFill raised={c.raised} goal={c.goal} impact={c.impact} /></Themed>;
}

export function ImpactGridWidget(p: AgWidgetParams) {
  const c = useCampaign(p);
  if (c.missing) return <Missing what={WHAT} />;
  return <Themed><ImpactGrid raised={c.raised} goal={c.goal} impact={c.impact} /></Themed>;
}

export function GoalWidget(p: AgWidgetParams) {
  const c = useCampaign(p);
  if (c.missing) return <Missing what={WHAT} />;
  return <Themed><GoalCard name={c.name} raised={c.raised} goal={c.goal} since={c.since} /></Themed>;
}

export function ActivityWidget({ widgetApi, dataMapping }: AgWidgetParams) {
  const m = dataMapping as Mapping;
  const id = m.id?.[0];
  const donor = m.donor?.[0];
  const amount = m.amount?.[0];
  const date = m.date?.[0];
  const anonymous = m.anonymous?.[0];
  const rows = useWidgetRows(widgetApi, [id, donor, amount, date, anonymous]);
  if (!id || !donor || !amount || !date || !anonymous) return <Missing what="a payment id, supporter, amount, date and anonymous flag" />;
  const feed = recentActivity(
    (rows ?? []).map((r) => ({
      id: String(r[keyOf(id)] ?? ''),
      donor: String(r[keyOf(donor)] ?? ''),
      amount: Number(r[keyOf(amount)]),
      date: String(r[keyOf(date)] ?? ''),
      anonymous: r[keyOf(anonymous)] === true || r[keyOf(anonymous)] === 'true',
    })).filter((g) => g.id && g.date && Number.isFinite(g.amount)),
    8,
  );
  return <Themed><ActivityFeed rows={feed} /></Themed>;
}
