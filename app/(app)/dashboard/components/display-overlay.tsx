'use client';

// Full-screen display for a screen at the event, in the dark-green Night Kitchen palette. Three
// columns: the goal picture filling up; raised so far over the impact grid; and the live feed of
// payments. Fed by the report data the dashboard already polls, so it updates on its own.
import { useEffect, useMemo } from 'react';
import { recentActivity } from '@/lib/campaign';
import { parseImpact } from '@/lib/impact';
import type { StudioData } from '@/lib/studio-data';
import {
  ActivityFeed, GoalCard, ImpactFill, ImpactGrid,
  closeClass, colClass, displayClass, liveClass, overlayClass, panelAutoClass, panelClass,
} from '../widgets/live-widgets';

export function DisplayOverlay({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const goal = data.campaign[0];
  const feed = useMemo(() => recentActivity(data.gifts, 8), [data.gifts]);
  const impact = useMemo(() => parseImpact(goal?.impact), [goal?.impact]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!goal) return null;
  return (
    <div className={`${overlayClass} ${displayClass}`} role="dialog" aria-label="Live display">
      <header>
        <h1>{data.org}</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className={liveClass}><i />Live</span>
          <button type="button" className={closeClass} onClick={onClose}>Esc · Exit display</button>
        </span>
      </header>
      <div className={colClass}>
        <div className={panelClass}><ImpactFill raised={goal.raised} goal={goal.goal} impact={impact} label={`Goal · ${goal.name}`} /></div>
      </div>
      <div className={colClass}>
        <div className={panelAutoClass}><GoalCard name={goal.name} raised={goal.raised} goal={goal.goal} since={goal.since} /></div>
        <div className={panelClass}><ImpactGrid raised={goal.raised} goal={goal.goal} impact={impact} /></div>
      </div>
      <div className={colClass}>
        <div className={panelClass}><ActivityFeed rows={feed} /></div>
      </div>
    </div>
  );
}
