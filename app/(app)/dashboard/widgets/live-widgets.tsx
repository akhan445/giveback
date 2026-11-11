'use client';

// The three live-display views as plain React components: a thermometer, a goal card and a donor
// leaderboard. The same components render inside AG Studio (as custom widgets, fed by Studio's
// data) and in the full-screen display (fed by the polled report data), so they always match.
import { useEffect, useState, type CSSProperties } from 'react';
import type { LeaderRow } from '@/lib/campaign';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import s from './live.module.css';

export const money = (v: number, digits = 0) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: DEFAULT_CURRENCY, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

const pctOf = (raised: number, goal: number) => (goal > 0 ? Math.min(1, Math.max(0, raised / goal)) : 0);

export function Thermometer({ raised, goal }: { raised: number; goal: number }) {
  const p = pctOf(raised, goal);
  // Tube from y=10 (goal) to y=250 (empty), bulb below.
  const top = 10, bottom = 250;
  const y = bottom - (bottom - top) * p;
  return (
    <div className={s.box}>
      <span className={s.label}>Progress to goal</span>
      <div className={s.thermo}>
        <svg viewBox="0 0 90 320" role="img" aria-label={`${Math.round(p * 100)}% of goal raised`}>
          <defs>
            <clipPath id="lv-tube"><path d={`M30 ${top + 8} a15 15 0 0 1 30 0 V${bottom + 8} a34 34 0 1 1 -30 0 Z`} /></clipPath>
          </defs>
          <path d={`M30 ${top + 8} a15 15 0 0 1 30 0 V${bottom + 8} a34 34 0 1 1 -30 0 Z`} fill="var(--lv-track)" stroke="var(--lv-line)" strokeWidth="2" />
          <g clipPath="url(#lv-tube)">
            <rect x="0" y={y} width="90" height="340" fill="var(--lv-accent)" style={{ transition: 'y .8s ease' }} />
          </g>
          {[0.25, 0.5, 0.75, 1].map((t) => {
            const ty = bottom - (bottom - top) * t;
            return <line key={t} x1="64" x2="76" y1={ty} y2={ty} stroke="var(--lv-muted)" strokeWidth="2" />;
          })}
        </svg>
        <div className={s.thermoText}>
          <span className={s.big}>{Math.round(p * 100)}%</span>
          <span className={s.sub}>{money(raised)} of {money(goal)}</span>
        </div>
      </div>
    </div>
  );
}

export function GoalCard({ name, raised, goal, since }: { name: string; raised: number; goal: number; since: string }) {
  const p = pctOf(raised, goal);
  const left = Math.max(0, goal - raised);
  return (
    <div className={s.box}>
      <span className={s.label}>{name}</span>
      <div className={s.goalWrap}>
        <span className={s.big}>{money(raised)}</span>
        <div className={s.bar}><i style={{ width: `${p * 100}%` } as CSSProperties} /></div>
        <span className={s.sub}>
          {left > 0 ? `${money(left)} to go of ${money(goal)}` : `Goal of ${money(goal)} reached`} · since {new Date(`${since}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

const NEW_MS = 10 * 60 * 1000;

export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  // Re-checked every 15 s so the NEW flag expires on its own.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className={s.box}>
      <span className={s.label}>Top supporters</span>
      {rows.length === 0 ? (
        <p className={s.sub}>No named supporters yet.</p>
      ) : (
        <ol className={s.list}>
          {rows.map((r) => (
            <li key={r.donor} className={s.row}>
              <span className={s.rank}>{String(r.rank).padStart(2, '0')}</span>
              <span className={s.name}>
                <b>
                  {r.donor}
                  {now - Date.parse(r.latestAt) < NEW_MS && <span className={s.new}>NEW</span>}
                </b>
                <span className={s.mini}><i style={{ width: `${(r.total / max) * 100}%` }} /></span>
              </span>
              <span className={s.amt}>{money(r.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export const themeClass = s.theme;
export const displayClass = s.display;
export const overlayClass = s.overlay;
export const closeClass = s.close;
