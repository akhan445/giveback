'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Goal } from '@/lib/campaign';
import { ORG_TYPES, TRADITIONS, type OrgProfile, type OrgType, type Tradition } from '@/lib/org';
import styles from '../overview/overview.module.css';

export function SettingsForm({ initial, initialGoal }: { initial: OrgProfile; initialGoal: Goal }) {
  const [goalName, setGoalName] = useState(initialGoal.name);
  const [goalDollars, setGoalDollars] = useState(String(initialGoal.goalCents / 100));
  const [name, setName] = useState(initial.name);
  const [orgType, setOrgType] = useState<OrgType>(initial.orgType);
  const [tradition, setTradition] = useState<Tradition>(initial.tradition ?? 'other');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    const res = await fetch('/api/org', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, orgType, tradition: orgType === 'faith' ? tradition : null }),
    });
    const goalRes = await fetch('/api/goal', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: goalName, goalCents: Math.round(Number(goalDollars) * 100), start: initialGoal.start }),
    });
    setState(res.ok && goalRes.ok ? 'saved' : 'error');
  }
  const field = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 } as const;
  const input = { border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', font: 'inherit', background: 'var(--bg)', color: 'var(--ink)' } as const;

  return (
    <div className={styles.root}>
      <div className={styles.wrap} style={{ maxWidth: 640 }}>
        <form className={styles.card} onSubmit={save}>
          <div style={field}><label className={styles.label} htmlFor="name">Organization name</label><input id="name" style={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
          <div style={field}>
            <label className={styles.label} htmlFor="type">Organization type</label>
            <select id="type" style={input} value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
              {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className={styles.sub}>The AI only suggests opportunities that fit this type: a mosque sees Ramadan, a food bank sees holiday hunger season, an ocean group sees World Oceans Day.</span>
          </div>
          {orgType === 'faith' && (
            <div style={field}>
              <label className={styles.label} htmlFor="tradition">Tradition</label>
              <select id="tradition" style={input} value={tradition} onChange={(e) => setTradition(e.target.value as Tradition)}>
                {Object.entries(TRADITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div style={field}><label className={styles.label} htmlFor="goalName">Fundraising goal name</label><input id="goalName" style={input} value={goalName} onChange={(e) => setGoalName(e.target.value)} maxLength={80} required /></div>
          <div style={field}>
            <label className={styles.label} htmlFor="goal">Goal amount</label>
            <input id="goal" style={input} type="number" min={1} step="1" value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} required />
            <span className={styles.sub}>Shown on the thermometer and goal card of the live display. Counts everything raised since the first of this month.</span>
          </div>
          <div className={styles.actions} style={{ alignItems: 'center' }}>
            <button className={`${styles.btn} ${styles.p}`} disabled={state === 'saving'}>Save</button>
            {state === 'saved' && <span className={`${styles.sub} ${styles.good}`}>Saved. <Link href="/overview" style={{ color: 'inherit' }}>Back to dashboard</Link></span>}
            {state === 'error' && <span className={styles.sub} style={{ color: 'var(--red)' }}>Could not save.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
