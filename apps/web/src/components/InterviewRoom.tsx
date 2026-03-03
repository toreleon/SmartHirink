'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  DataPacket_Kind,
} from 'livekit-client';
import { useInterviewStore } from '@/lib/store';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

interface InterviewRoomProps {
  token: string;
  roomName: string;
  onSessionComplete?: () => void;
}

export default function InterviewRoom({ token, roomName, onSessionComplete }: InterviewRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    phase,
    speaking,
    transcripts,
    aiPartialText,
    candidatePartialText,
    error,
    isConnected,
    setPhase,
    setSpeaking,
    addTranscript,
    setAiPartialText,
    setCandidatePartialText,
    setError,
    setConnected,
    reset,
  } = useInterviewStore();

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, aiPartialText, candidatePartialText]);

  // ─── Connect to LiveKit Room ────────────────────────────
  useEffect(() => {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    // Handle data messages from agent
    room.on(RoomEvent.DataReceived, (data, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(data));
        handleAgentMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle agent audio track
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity.startsWith('agent_')
      ) {
        // Attach agent audio to an audio element
        const element = track.attach();
        document.body.appendChild(element);
        audioRef.current = element as HTMLAudioElement;
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });

    room.on(RoomEvent.Connected, () => {
      setConnected(true);
    });

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
    });

    // Connect
    room
      .connect(LIVEKIT_URL, token)
      .then(async () => {
        // Publish microphone
        await room.localParticipant.setMicrophoneEnabled(true);
      })
      .catch((err) => {
        setError(`Failed to connect: ${err.message}`);
      });

    return () => {
      room.disconnect();
      audioRef.current?.remove();
      reset();
    };
  }, [token]);

  // ─── Handle Agent Messages ──────────────────────────────
  const handleAgentMessage = useCallback(
    (msg: any) => {
      switch (msg.type) {
        case 'partial_transcript':
          setCandidatePartialText(msg.text);
          break;

        case 'final_transcript':
          addTranscript({
            turnId: msg.turnId,
            role: 'CANDIDATE',
            text: msg.text,
            isFinal: true,
            timestamp: msg.t,
          });
          break;

        case 'ai_text':
          setAiPartialText(msg.text);
          break;

        case 'state':
          setPhase(msg.phase);
          setSpeaking(msg.speaking.who);
          // When AI finishes speaking and we have accumulated AI text
          if (msg.speaking.who === 'NONE' && aiPartialText) {
            addTranscript({
              turnId: msg.t.toString(),
              role: 'AI',
              text: aiPartialText,
              isFinal: true,
              timestamp: msg.t,
            });
          }
          break;

        case 'error':
          setError(msg.message);
          if (msg.recoverable) {
            setTimeout(() => setError(null), 5000);
          }
          break;

        case 'session_complete':
          setPhase('COMPLETED');
          onSessionComplete?.();
          break;
      }
    },
    [aiPartialText],
  );

  // ─── Send Client Events ─────────────────────────────────
  const sendClientEvent = (action: 'start' | 'pause' | 'stop' | 'ping') => {
    const room = roomRef.current;
    if (!room) return;

    const msg = JSON.stringify({
      type: 'client_event',
      action,
      t: Date.now(),
    });

    room.localParticipant.publishData(new TextEncoder().encode(msg), {
      reliable: true,
    });
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Status Bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium text-slate-600">
            {isConnected ? 'Đã kết nối' : 'Đang kết nối...'}
          </span>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
            {phase}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {speaking === 'AI' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded pulse-animation">
              🤖 AI đang nói...
            </span>
          )}
          {speaking === 'CANDIDATE' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded pulse-animation">
              🎙️ Bạn đang nói...
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {phase === 'COMPLETED' ? (
            <span className="text-sm text-green-600 font-medium">✅ Hoàn thành</span>
          ) : (
            <button
              onClick={() => sendClientEvent('stop')}
              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600"
            >
              Kết thúc
            </button>
          )}
        </div>
      </div>

      {/* AI Disclosure Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
        <p className="text-amber-800 text-xs text-center">
          🤖 Bạn đang trao đổi với AI phỏng vấn viên. Cuộc phỏng vấn được ghi âm và phiên âm tự
          động. Kết quả đánh giá chỉ mang tính tham khảo.
        </p>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 transcript-container">
        <div className="max-w-3xl mx-auto space-y-4">
          {transcripts.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === 'AI' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-xl ${
                  t.role === 'AI'
                    ? 'bg-blue-50 text-slate-800 rounded-tl-sm'
                    : 'bg-primary-600 text-white rounded-tr-sm'
                }`}
              >
                <p className="text-xs font-medium mb-1 opacity-70">
                  {t.role === 'AI' ? '🤖 Phỏng vấn viên' : '👤 Bạn'}
                </p>
                <p className="text-sm whitespace-pre-wrap">{t.text}</p>
              </div>
            </div>
          ))}

          {/* Partial transcripts (live) */}
          {candidatePartialText && (
            <div className="flex justify-end">
              <div className="max-w-[80%] px-4 py-3 rounded-xl bg-primary-400 text-white rounded-tr-sm opacity-70">
                <p className="text-xs font-medium mb-1 opacity-70">👤 Bạn (đang nói...)</p>
                <p className="text-sm">{candidatePartialText}</p>
              </div>
            </div>
          )}

          {aiPartialText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-3 rounded-xl bg-blue-50 text-slate-800 rounded-tl-sm opacity-70">
                <p className="text-xs font-medium mb-1 opacity-70">🤖 Phỏng vấn viên (đang trả lời...)</p>
                <p className="text-sm">{aiPartialText}</p>
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-md max-w-sm">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
