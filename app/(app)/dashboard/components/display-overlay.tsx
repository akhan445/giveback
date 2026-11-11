'use client';

// Full-screen display for a screen at the event: dark green, the picture filling toward the goal, the
// milestone grid, the raised-so-far card and the live feed of payments. Fed by the report data the
// dashboard already polls, so it updates on its own.
import { useEffect, useMemo } from 'react';
import { recentActivity } from '@/lib/campaign';
import type { StudioData } from '@/lib/studio-data';
import { ActivityFeed, GoalCard, ImpactFill, ImpactGrid, closeClass, colClass, displayClass, growClass, overlayClass } from '../widgets/live-widgets';

export function DisplayOverlay({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const goal = data.campaign[0];
  const feed = useMemo(() => recentActivity(data.gifts, 8), [data.gifts]);

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
        <button type="button" className={closeClass} onClick={onClose}>Esc · Exit display</button>
      </header>
      <div className={colClass}><div className={growClass}><ImpactFill raised={goal.raised} goal={goal.goal} theme={goal.theme} /></div></div>
      <div className={colClass}><div className={growClass}><ImpactGrid raised={goal.raised} goal={goal.goal} theme={goal.theme} /></div></div>
      <div className={colClass}>
        <GoalCard name={goal.name} raised={goal.raised} goal={goal.goal} since={goal.since} />
        <div className={growClass}><ActivityFeed rows={feed} /></div>
      </div>
    </div>
  );
}
