'use client';

// Full-screen display for a screen at the event: dark green, the thermometer, the goal and the live
// leaderboard. Fed by the report data the dashboard already polls, so it updates on its own.
import { useEffect, useMemo } from 'react';
import { leaderboard } from '@/lib/campaign';
import type { StudioData } from '@/lib/studio-data';
import { GoalCard, Leaderboard, Thermometer, closeClass, displayClass, overlayClass } from '../widgets/live-widgets';

export function DisplayOverlay({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const goal = data.campaign[0];
  const rows = useMemo(() => (goal ? leaderboard(data.gifts, goal.since, 8) : []), [data.gifts, goal]);

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
      <div className="left" style={{ display: 'flex', flexDirection: 'column', gap: '3vh', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}><Thermometer raised={goal.raised} goal={goal.goal} /></div>
        <GoalCard name={goal.name} raised={goal.raised} goal={goal.goal} since={goal.since} />
      </div>
      <Leaderboard rows={rows} />
    </div>
  );
}
