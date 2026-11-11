'use client';

// AG Studio wrappers for the live-display views. Each reads the fields it is mapped to (so it follows
// Studio's data and filters) and hands plain numbers to the shared components in ./live-widgets.
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import { leaderboard } from '@/lib/campaign';
import { GoalCard, Leaderboard, Thermometer, themeClass } from './live-widgets';
import { keyOf, useWidgetRows } from './use-widget-rows';

type Mapping = Record<string, AgWidgetField[] | undefined>;
const Missing = ({ what }: { what: string }) => <p style={{ padding: 16 }}>Map {what}.</p>;

function useCampaign({ widgetApi, dataMapping }: AgWidgetParams) {
  const m = dataMapping as Mapping;
  const raised = m.raised?.[0];
  const goal = m.goal?.[0];
  const name = m.name?.[0];
  const since = m.since?.[0];
  const rows = useWidgetRows(widgetApi, [raised, goal, name, since]);
  if (!raised || !goal || !name || !since) return { missing: true as const };
  const r = rows?.[0];
  return {
    missing: false as const,
    raised: Number(r?.[keyOf(raised)] ?? 0),
    goal: Number(r?.[keyOf(goal)] ?? 0),
    name: String(r?.[keyOf(name)] ?? ''),
    since: String(r?.[keyOf(since)] ?? '').slice(0, 10),
  };
}

export function ThermometerWidget(p: AgWidgetParams) {
  const c = useCampaign(p);
  if (c.missing) return <Missing what="raised, goal, name and start" />;
  return <div className={themeClass} style={{ height: '100%' }}><Thermometer raised={c.raised} goal={c.goal} /></div>;
}

export function GoalWidget(p: AgWidgetParams) {
  const c = useCampaign(p);
  if (c.missing) return <Missing what="raised, goal, name and start" />;
  return <div className={themeClass} style={{ height: '100%' }}><GoalCard name={c.name} raised={c.raised} goal={c.goal} since={c.since} /></div>;
}

export function LeaderboardWidget({ widgetApi, dataMapping }: AgWidgetParams) {
  const m = dataMapping as Mapping;
  const donor = m.donor?.[0];
  const amount = m.amount?.[0];
  const latest = m.latest?.[0];
  const rows = useWidgetRows(widgetApi, [donor, amount, latest]);
  let board: ReturnType<typeof leaderboard> = [];
  if (donor && amount && latest && rows) {
    // Studio already grouped by supporter and summed; rank them (named supporters only).
    const list = rows
      .map((r) => ({ donor: String(r[keyOf(donor)] ?? ''), amount: Number(r[keyOf(amount)]), date: String(r[keyOf(latest)] ?? ''), anonymous: false }))
      .filter((r) => r.donor && r.donor !== 'Anonymous' && Number.isFinite(r.amount));
    board = leaderboard(list, '0000-00-00', 8);
  }
  if (!donor || !amount || !latest) return <Missing what="a supporter, an amount and a latest date" />;
  return <div className={themeClass} style={{ height: '100%' }}><Leaderboard rows={board} /></div>;
}
