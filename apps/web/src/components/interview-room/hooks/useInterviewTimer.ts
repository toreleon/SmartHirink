'use client';

import { useState, useEffect } from 'react';
import { useInterviewStore } from '@/lib/store';

export function useInterviewTimer(durationMinutes = 30) {
  const timerStartedAt = useInterviewStore((s) => s.timerStartedAt);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timerStartedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  const totalSeconds = durationMinutes * 60;
  const percent = Math.min((elapsed / totalSeconds) * 100, 100);

  const format = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return {
    elapsed,
    elapsedFormatted: format(elapsed),
    totalFormatted: format(totalSeconds),
    percent,
    isWarning: percent >= 80,
    isOvertime: percent >= 100,
  };
}
