'use client';

import { ConnectionIndicator } from './ConnectionIndicator';
import { PhaseIndicator } from './PhaseIndicator';
import { InterviewTimer } from './InterviewTimer';
import { SpeakingIndicator } from './SpeakingIndicator';

interface Props {
  durationMinutes?: number;
}

export function RoomStatusBar({ durationMinutes }: Props) {
  return (
    <div className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <ConnectionIndicator />
        <PhaseIndicator />
        <InterviewTimer durationMinutes={durationMinutes} />
      </div>

      <SpeakingIndicator />
    </div>
  );
}
