'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Goal } from '@/lib/campaign';
import { CELL_SHAPES, HERO_SHAPES, defaultImpact, resolveImpact, type CellShape, type HeroShape, type Impact } from '@/lib/impact';
import { ORG_TYPES, TRADITIONS, type OrgProfile, type OrgType, type Tradition } from '@/lib/org';
import { displayClass } from '../dashboard/widgets/live-widgets';
import { ImpactFill, ImpactGrid } from '../dashboard/widgets/live-widgets';
import styles from '../overview/overview.module.css';

const PREVIEW_PCT = 0.71;

export function SettingsForm({ initial, initialGoal }: { initial: OrgProfile; initialGoal: Goal }) {
  // Organization
  const [name, setName] = useState(initial.name);
  const [orgType, setOrgType] = useState<OrgType>(initial.orgType);
  const [tradition, setTradition] = useState<Tradition>(initial.tradition ?? 'other');
  // Goal and raised so far
  const [goalName, setGoalName] = useState(initialGoal.name);
  const [goalDollars, setGoalDollars] = useState(String(initialGoal.goalCents / 100));
  const [start, setStart] = useState(initialGoal.start ?? '');
  // Impact: custom = the organization has its own choices; otherwise the defaults for its type apply.
  const [custom, setCustom] = useState(initialGoal.impact !== null);
  const [impact, setImpact] = useState<Impact>(resolveImpact(initial.orgType, initialGoal.impact));
  // The cost is typed as text so half-finished input ("", "0.") doesn't get clamped while typing.
  const [costText, setCostText] = useState(String(resolveImpact(initial.orgType, initialGoal.impact).unitCents / 100));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const changeType = (next: OrgType) => {
    setOrgType(next);
    if (!custom) {
      setImpact(defaultImpact(next));
      setCostText(String(defaultImpact(next).unitCents / 100));
    }
  };
  const editImpact = (patch: Partial<Impact>) => {
    setCustom(true);
    setImpact((cur) => ({ ...cur, ...patch }));
  };
  const resetImpact = () => {
    setCustom(false);
    setImpact(defaultImpact(orgType));
    setCostText(String(defaultImpact(orgType).unitCents / 100));
  };

  const goalCents = Math.round(Number(goalDollars) * 100);
  const validGoal = Number.isFinite(goalCents) && goalCents >= 100;
  const validCost = Number.isFinite(Number(costText)) && Number(costText) >= 0.01;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validGoal || !validCost) return;
    setState('saving');
    const headers = { 'content-type': 'application/json' };
    const [orgRes, goalRes] = await Promise.all([
      fetch('/api/org', { method: 'PUT', headers, body: JSON.stringify({ name, orgType, tradition: orgType === 'faith' ? tradition : null }) }),
      fetch('/api/goal', { method: 'PUT', headers, body: JSON.stringify({ name: goalName, goalCents, start: start || null, impact: custom ? impact : null }) }),
    ]);
    setState(orgRes.ok && goalRes.ok ? 'saved' : 'error');
  }

  const field = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 } as const;
  const input = { border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', font: 'inherit', background: 'var(--bg)', color: 'var(--ink)' } as const;
  const two = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 } as const;
  const h = { margin: '0 0 12px', fontSize: 16, fontWeight: 600 } as const;

  return (
    <div className={styles.root}>
      <div className={styles.wrap} style={{ maxWidth: 760 }}>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className={styles.card}>
            <h2 style={h}>Organization</h2>
            <div style={field}><label className={styles.label} htmlFor="name">Organization name</label><input id="name" style={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
            <div style={field}>
              <label className={styles.label} htmlFor="type">Organization type</label>
              <select id="type" style={input} value={orgType} onChange={(e) => changeType(e.target.value as OrgType)}>
                {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className={styles.sub}>The AI only suggests opportunities that fit this type, and the live display picks a matching picture and unit (meals, trees, animals...) until you change them below.</span>
            </div>
            {orgType === 'faith' && (
              <div style={field}>
                <label className={styles.label} htmlFor="tradition">Tradition</label>
                <select id="tradition" style={input} value={tradition} onChange={(e) => setTradition(e.target.value as Tradition)}>
                  {Object.entries(TRADITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 style={h}>Goal and raised so far</h2>
            <span className={styles.sub} style={{ display: 'block', marginBottom: 14 }}>Drives the Goal picture, the Raised so far card and the progress bar on the live display.</span>
            <div style={field}><label className={styles.label} htmlFor="goalName">Goal name</label><input id="goalName" style={input} value={goalName} onChange={(e) => setGoalName(e.target.value)} maxLength={80} required /></div>
            <div style={two}>
              <div style={field}>
                <label className={styles.label} htmlFor="goal">Goal amount</label>
                <input id="goal" style={input} type="number" min={1} step="1" value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} required />
              </div>
              <div style={field}>
                <label className={styles.label} htmlFor="start">Counting since</label>
                <input id="start" style={input} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                <span className={styles.sub}>Leave empty to count from the first of this month.</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2 style={h}>Impact</h2>
            <span className={styles.sub} style={{ display: 'block', marginBottom: 14 }}>
              What the money does, shown as a picture that fills up and a grid that lights up.{' '}
              {custom ? 'You are using your own choices.' : `Using the defaults for ${ORG_TYPES[orgType].toLowerCase()}.`}
            </span>
            <div style={two}>
              <div style={field}>
                <label className={styles.label} htmlFor="hero">Picture that fills</label>
                <select id="hero" style={input} value={impact.hero} onChange={(e) => editImpact({ hero: e.target.value as HeroShape })}>
                  {Object.entries(HERO_SHAPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={field}>
                <label className={styles.label} htmlFor="cell">Grid icon</label>
                <select id="cell" style={input} value={impact.cell} onChange={(e) => editImpact({ cell: e.target.value as CellShape })}>
                  {Object.entries(CELL_SHAPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={field}>
                <label className={styles.label} htmlFor="unit">What we count</label>
                <input id="unit" style={input} value={impact.unit} onChange={(e) => editImpact({ unit: e.target.value })} maxLength={30} required />
                <span className={styles.sub}>Plural, like meals, trees or families.</span>
              </div>
              <div style={field}>
                <label className={styles.label} htmlFor="done">Headline wording</label>
                <input id="done" style={input} value={impact.done} onChange={(e) => editImpact({ done: e.target.value })} maxLength={40} required />
                <span className={styles.sub}>Like meals served or trees planted.</span>
              </div>
              <div style={field}>
                <label className={styles.label} htmlFor="cost">Cost of one {impact.unit.replace(/s$/, '') || 'unit'}</label>
                <input
                  id="cost" style={input} type="number" min={0.01} step="0.01"
                  value={costText}
                  onChange={(e) => {
                    setCostText(e.target.value);
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0.01) editImpact({ unitCents: Math.round(n * 100) });
                  }}
                  required
                />
                <span className={styles.sub}>An estimate; the count is the amount raised divided by this.</span>
              </div>
            </div>
            <div className={displayClass} style={{ marginTop: 6, padding: 14, borderRadius: 4, background: 'var(--lv-bg)', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, height: 260 }} aria-label="Preview">
              <ImpactFill raised={PREVIEW_PCT * 1000} goal={1000} impact={impact} label="Preview · 71%" />
              <ImpactGrid raised={PREVIEW_PCT * goalCents / 100} goal={validGoal ? goalCents / 100 : 1} impact={impact} />
            </div>
            <div className={styles.actions} style={{ marginTop: 12 }}>
              <button type="button" className={styles.btn} onClick={resetImpact} disabled={!custom}>Use defaults for this type</button>
            </div>
          </section>

          <div className={styles.actions} style={{ alignItems: 'center' }}>
            <button className={`${styles.btn} ${styles.p}`} disabled={state === 'saving' || !validGoal || !validCost}>Save</button>
            {state === 'saved' && <span className={`${styles.sub} ${styles.good}`}>Saved. <Link href="/dashboard" style={{ color: 'inherit' }}>Open the live display</Link></span>}
            {state === 'error' && <span className={styles.sub} style={{ color: 'var(--red)' }}>Could not save.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
