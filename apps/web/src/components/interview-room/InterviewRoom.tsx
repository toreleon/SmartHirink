'use client';

import { useInterviewStore } from '@/lib/store';
import { InterviewRoomProvider } from './InterviewRoomProvider';
import { RoomStatusBar } from './components/RoomStatusBar';
import { AIDisclosureBanner } from './components/AIDisclosureBanner';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ControlBar } from './components/ControlBar';
import { CompletionOverlay } from './components/CompletionOverlay';

interface InterviewRoomProps {
  token: string;
  roomName: string;
  onSessionComplete?: () => void;
  durationMinutes?: number;
}

export default function InterviewRoom({
  token,
  roomName,
  onSessionComplete,
  durationMinutes = 30,
}: InterviewRoomProps) {
  const error = useInterviewStore((s) => s.error);

  return (
    <InterviewRoomProvider
      token={token}
      roomName={roomName}
      onSessionComplete={onSessionComplete}
    >
      <div className="flex flex-col h-screen relative">
        <RoomStatusBar durationMinutes={durationMinutes} />
        <AIDisclosureBanner />
        <TranscriptPanel />
        <ControlBar />
        <CompletionOverlay />

        {/* Error toast */}
        {error && (
          <div className="fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 shadow-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </InterviewRoomProvider>
  );
}
