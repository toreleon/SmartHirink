'use client';

import { useContext } from 'react';
import { useInterviewStore } from '@/lib/store';
import { InterviewRoomProvider, InterviewRoomContext } from './InterviewRoomProvider';
import { RoomStatusBar } from './components/RoomStatusBar';
import { AIDisclosureBanner } from './components/AIDisclosureBanner';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ControlBar } from './components/ControlBar';
import { CompletionOverlay } from './components/CompletionOverlay';
import { Volume2 } from 'lucide-react';

interface InterviewRoomProps {
  sessionId: string;
  onSessionComplete?: () => void;
  durationMinutes?: number;
}

function InterviewRoomInner({ durationMinutes }: { durationMinutes: number }) {
  const error = useInterviewStore((s) => s.error);
  const ctx = useContext(InterviewRoomContext);

  return (
    <div className="flex flex-col h-screen relative">
      <RoomStatusBar durationMinutes={durationMinutes} />
      <AIDisclosureBanner />
      <TranscriptPanel />
      <ControlBar />
      <CompletionOverlay />

      {/* Audio playback blocked banner */}
      {ctx && !ctx.canPlaybackAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <button
            onClick={() => ctx.startAudio?.()}
            className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-6 shadow-2xl"
          >
            <Volume2 className="h-10 w-10 text-primary" />
            <span className="text-lg font-semibold">Tap to enable audio</span>
            <span className="text-sm text-muted-foreground">
              Your browser blocked audio playback
            </span>
          </button>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 shadow-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function InterviewRoom({
  sessionId,
  onSessionComplete,
  durationMinutes = 30,
}: InterviewRoomProps) {
  return (
    <InterviewRoomProvider
      sessionId={sessionId}
      onSessionComplete={onSessionComplete}
    >
      <InterviewRoomInner durationMinutes={durationMinutes} />
    </InterviewRoomProvider>
  );
}
