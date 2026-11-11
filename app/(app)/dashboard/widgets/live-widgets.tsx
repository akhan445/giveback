'use client';

// The live-display views as plain React components: a picture that fills toward the goal, a grid of
// plates (or trees, paws...) for the milestone, a "raised so far" card and a feed of the latest
// payments. The same components render inside AG Studio (as custom widgets, fed by Studio's data)
// and in the full-screen display (fed by the polled report data), so they always match.
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { timeAgo, type Activity } from '@/lib/campaign';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { impactFor, unitsFor, type CellShape, type Shape } from '@/lib/impact';
import s from './live.module.css';

export const money = (v: number, digits = 0) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: DEFAULT_CURRENCY, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

const pctOf = (raised: number, goal: number) => (goal > 0 ? Math.min(1, Math.max(0, raised / goal)) : 0);

// --- Shapes (100 x 100 box) -----------------------------------------------------------

function ShapePaths({ shape }: { shape: CellShape }) {
  switch (shape) {
    case 'bowl':
      return <path d="M8 42 H92 C92 72 74 90 50 90 C26 90 8 72 8 42 Z" />;
    case 'plate':
      return <circle cx="50" cy="50" r="44" />;
    case 'tree':
      return <path d="M50 6 C28 6 14 22 18 40 C8 46 12 66 30 66 H44 V94 H56 V66 H70 C88 66 92 46 82 40 C86 22 72 6 50 6 Z" />;
    case 'paw':
      return (
        <>
          <ellipse cx="50" cy="66" rx="24" ry="20" />
          <ellipse cx="22" cy="42" rx="9" ry="12" />
          <ellipse cx="40" cy="26" rx="9" ry="13" />
          <ellipse cx="60" cy="26" rx="9" ry="13" />
          <ellipse cx="78" cy="42" rx="9" ry="12" />
        </>
      );
    case 'heart':
      return <path d="M50 92 C8 60 4 30 24 18 C36 11 46 17 50 28 C54 17 64 11 76 18 C96 30 92 60 50 92 Z" />;
    case 'book':
      return <path d="M6 22 C26 15 40 17 50 26 C60 17 74 15 94 22 V80 C74 73 60 75 50 85 C40 75 26 73 6 80 Z" />;
    case 'star':
      return <polygon points="50,5 62,37 96,38 69,59 79,93 50,73 21,93 31,59 4,38 38,37" />;
    case 'ball':
      return <circle cx="50" cy="50" r="44" />;
  }
}

// Strokes drawn over the filled shape for detail (steam over the bowl, seams on the ball).
function Detail({ shape }: { shape: Shape }) {
  const line = { stroke: 'var(--lv-muted)', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round' as const };
  if (shape === 'bowl')
    return (
      <g {...line}>
        <path d="M35 32 C30 24 40 20 35 10" />
        <path d="M50 32 C45 24 55 20 50 10" />
        <path d="M65 32 C60 24 70 20 65 10" />
        <path d="M34 94 H66" />
      </g>
    );
  if (shape === 'ball')
    return (
      <g {...line}>
        <path d="M50 6 V94 M6 50 H94" opacity=".5" />
        <path d="M22 20 C40 40 40 60 22 80 M78 20 C60 40 60 60 78 80" opacity=".5" />
      </g>
    );
  return null;
}

// --- The picture that fills -------------------------------------------------------------

export function ImpactFill({ raised, goal, theme }: { raised: number; goal: number; theme: string }) {
  const impact = impactFor(theme);
  const p = pctOf(raised, goal);
  const id = useId();
  const y = 94 - 88 * p;
  return (
    <div className={s.box}>
      <span className={s.label}>Progress to goal</span>
      <div className={s.fillWrap}>
        <svg viewBox="0 0 100 100" role="img" aria-label={`${Math.round(p * 100)}% of goal raised`}>
          <defs>
            <clipPath id={id}><ShapePaths shape={impact.hero} /></clipPath>
          </defs>
          <g fill="var(--lv-dim)" stroke="var(--lv-line)" strokeWidth="1.5"><ShapePaths shape={impact.hero} /></g>
          <g clipPath={`url(#${id})`}>
            <rect x="0" y={y} width="100" height="100" fill="var(--lv-lit)" style={{ transition: 'y .8s ease' }} />
          </g>
          <Detail shape={impact.hero as Shape} />
        </svg>
        <div className={s.fillText}>
          <span className={s.big}>{Math.round(p * 100)}%</span>
          <span className={s.sub}>{money(raised)} of {money(goal)}</span>
        </div>
      </div>
    </div>
  );
}

// --- The milestone grid -----------------------------------------------------------------

const COLS = 20;
const ROWS = 12;

export function ImpactGrid({ raised, goal, theme }: { raised: number; goal: number; theme: string }) {
  const impact = impactFor(theme);
  const cells = COLS * ROWS;
  const lit = pctOf(raised, goal) * cells;
  const served = unitsFor(raised, impact);
  const target = unitsFor(goal, impact);
  const each = Math.max(1, Math.round(target / cells));
  // Row 0 on screen is the top; plates fill from the bottom-left, row by row, up to the top.
  const cellAt = (row: number, col: number) => (ROWS - 1 - row) * COLS + col;
  return (
    <div className={s.box}>
      <span className={s.label}>{impact.done}</span>
      <div className={s.gridHead}>
        <span className={s.big}>{served.toLocaleString('en-CA')}</span>
        <span className={s.sub}>of {target.toLocaleString('en-CA')} {impact.unit} · each plate ≈ {each.toLocaleString('en-CA')}</span>
      </div>
      <div className={s.cells} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} role="img" aria-label={`${served} ${impact.done} of ${target}`}>
        {Array.from({ length: cells }, (_, i) => {
          const row = Math.floor(i / COLS);
          const idx = cellAt(row, i % COLS);
          const on = idx + 1 <= Math.floor(lit);
          const partial = !on && idx < lit;
          return (
            <svg key={i} viewBox="0 0 100 100" className={s.cell} style={{ color: on || partial ? 'var(--lv-lit)' : 'var(--lv-dim)', opacity: partial ? 0.35 + 0.65 * (lit - idx) : 1 } as CSSProperties}>
              <g fill="currentColor"><ShapePaths shape={impact.cell} /></g>
              {impact.cell === 'plate' && <circle cx="50" cy="50" r="24" fill="none" stroke="var(--lv-bg)" strokeWidth="6" opacity=".55" />}
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

// --- Live feed of payments ----------------------------------------------------------------

const FRESH_MS = 2 * 60 * 1000;

export function ActivityFeed({ rows }: { rows: Activity[] }) {
  // Re-read the clock every 15 s so "just now" turns into "1 min ago" on its own.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={s.box}>
      <span className={s.label}>Live</span>
      {rows.length === 0 ? (
        <p className={s.sub}>Waiting for the first payment.</p>
      ) : (
        <ol className={s.list}>
          {rows.map((r) => (
            <li key={r.id} className={s.row}>
              <span className={`${s.dot} ${now > 0 && now - Date.parse(r.at) < FRESH_MS ? s.fresh : ''}`} aria-hidden />
              <span className={s.who}>
                <b>{r.who}</b> paid <span className={s.amt}>{money(r.amount, r.amount % 1 ? 2 : 0)}</span>
              </span>
              <span className={s.when}>{now ? timeAgo(r.at, now) : ''}</span>
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
export const colClass = s.col;
export const growClass = s.grow;
