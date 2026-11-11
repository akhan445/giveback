'use client';

// The live-display views as plain React components: a picture that fills toward the goal, a grid of
// plates (or trees, paws...) for the milestone, a "raised so far" card and a feed of the latest
// payments. The same components render inside AG Studio (as custom widgets, fed by Studio's data)
// and in the full-screen display (fed by the polled report data), so they always match.
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { timeAgo, type Activity } from '@/lib/campaign';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { unitsFor, type Impact } from '@/lib/impact';
import { CELL, HERO } from './shapes';
import s from './live.module.css';

export const money = (v: number, digits = 0) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: DEFAULT_CURRENCY, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

const pctOf = (raised: number, goal: number) => (goal > 0 ? Math.min(1, Math.max(0, raised / goal)) : 0);

// --- The picture that fills -------------------------------------------------------------

export function ImpactFill({ raised, goal, impact, label = 'Goal' }: { raised: number; goal: number; impact: Impact; label?: string }) {
  const art = HERO[impact.hero];
  const p = pctOf(raised, goal);
  const id = useId();
  const y = art.range[1] - (art.range[1] - art.range[0]) * p;
  return (
    <div className={s.box}>
      <span className={s.label}>{label}</span>
      <div className={s.fillWrap}>
        <svg viewBox="0 0 100 100" role="img" aria-label={`${Math.round(p * 100)}% of goal raised`}>
          <defs>
            <clipPath id={id} dangerouslySetInnerHTML={{ __html: art.body }} />
          </defs>
          <g fill="var(--lv-dim)" stroke="var(--lv-line)" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: art.body }} />
          <g clipPath={`url(#${id})`}>
            <rect x="0" y={y} width="100" height="100" fill="var(--lv-accent)" style={{ transition: 'y .8s ease' }} />
            <rect x="0" y={y} width="100" height="1.6" fill="var(--lv-lit)" opacity=".7" style={{ transition: 'y .8s ease' }} />
          </g>
          <g dangerouslySetInnerHTML={{ __html: art.detail }} />
        </svg>
        <div className={s.fillText}>
          <span className={s.pct}>{Math.round(p * 100)}%</span>
          <span className={s.sub}>{money(raised)} of {money(goal)}</span>
        </div>
      </div>
    </div>
  );
}

// --- The milestone grid -----------------------------------------------------------------

const COLS = 20;
const ROWS = 11;

export function ImpactGrid({ raised, goal, impact }: { raised: number; goal: number; impact: Impact }) {
  const cells = COLS * ROWS;
  const lit = pctOf(raised, goal) * cells;
  const served = unitsFor(raised, impact);
  const target = unitsFor(goal, impact);
  const each = Math.max(1, Math.round(target / cells));
  // Row 0 on screen is the top; cells fill from the bottom-left, row by row, up to the top.
  const cellAt = (row: number, col: number) => (ROWS - 1 - row) * COLS + col;
  return (
    <div className={s.box}>
      <span className={s.label}>Impact <em>{impact.done}</em></span>
      <div className={s.gridHead}>
        <span className={s.bigSm}>{served.toLocaleString('en-CA')}</span>
        <span className={s.sub}>of {target.toLocaleString('en-CA')} {impact.unit} · each icon ≈ {each.toLocaleString('en-CA')}</span>
      </div>
      <div className={s.cells} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} role="img" aria-label={`${served} ${impact.done} of ${target}`}>
        {Array.from({ length: cells }, (_, i) => {
          const idx = cellAt(Math.floor(i / COLS), i % COLS);
          const on = idx + 1 <= Math.floor(lit);
          const partial = !on && idx < lit;
          return (
            <svg
              key={i}
              viewBox="0 0 100 100"
              className={s.cell}
              style={{ color: on || partial ? 'var(--lv-lit)' : 'var(--lv-dim)', opacity: partial ? 0.35 + 0.65 * (lit - idx) : 1 } as CSSProperties}
            >
              <g fill="currentColor" dangerouslySetInnerHTML={{ __html: CELL[impact.cell] }} />
            </svg>
          );
        })}
      </div>
    </div>
  );
}

// --- Raised so far ----------------------------------------------------------------------

export function GoalCard({ name, raised, goal, since }: { name: string; raised: number; goal: number; since: string }) {
  const p = pctOf(raised, goal);
  const left = Math.max(0, goal - raised);
  return (
    <div className={s.box}>
      <span className={s.label}>Raised so far <em>{name}</em></span>
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

// --- Live feed of payments ----------------------------------------------------------------

const FRESH_MS = 2 * 60 * 1000;

// A payment that just arrived mounts as a new row at the top (so the others move down) and pulses once.
export function ActivityFeed({ rows }: { rows: Activity[] }) {
  // Re-read the clock every 15 s so "just now" turns into "1 min ago" on its own.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  // Show only as many rows as fit, so the last one is never cut off.
  const listRef = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState(8);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      // The tallest row (a new row is still growing while it animates in).
      const tallest = Math.max(0, ...[...el.querySelectorAll('li')].map((li) => li.offsetHeight));
      if (tallest > 0) setFit(Math.max(1, Math.floor(el.clientHeight / tallest)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);
  return (
    <div className={s.box}>
      <span className={s.label}>Latest payments <em>live</em></span>
      {rows.length === 0 ? (
        <p className={s.sub}>Waiting for the first payment.</p>
      ) : (
        <ol className={s.list} ref={listRef}>
          {rows.slice(0, fit).map((r) => {
            const fresh = now > 0 && now - Date.parse(r.at) < FRESH_MS;
            return (
              <li key={r.id} className={`${s.row} ${fresh ? s.fresh : ''}`}>
                <span className={s.dot} aria-hidden />
                <span className={s.who}>{r.who} <span>paid</span></span>
                <span className={s.amt}>{money(r.amount, r.amount % 1 ? 2 : 0)}</span>
                <span className={s.when}>{now ? timeAgo(r.at, now) : ''}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export const themeClass = s.theme;
export const displayClass = s.display;
export const overlayClass = s.overlay;
export const closeClass = s.close;
export const colClass = s.col;
export const panelClass = s.panel;
export const panelAutoClass = `${s.panel} ${s.auto}`;
export const liveClass = s.live;
