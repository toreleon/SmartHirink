'use client';

import { createContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useInterviewStore } from '@/lib/store';

const LIVEKIT_URL = (process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880').replace(/\/+$/, '');

export interface InterviewRoomContextValue {
  sendClientEvent: (action: 'start' | 'pause' | 'stop' | 'ping') => void;
  toggleMic: () => Promise<void>;
  setVolume: (volume: number) => void;
}

export const InterviewRoomContext = createContext<InterviewRoomContextValue | null>(null);

interface Props {
  token: string;
  roomName: string;
  onSessionComplete?: () => void;
  children: ReactNode;
}

export function InterviewRoomProvider({ token, onSessionComplete, children }: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    aiPartialText,
    setPhase,
    setSpeaking,
    addTranscript,
    setAiPartialText,
    setCandidatePartialText,
    setError,
    setConnected,
    setConnectionQuality,
    setIsMicMuted,
    setTimerStartedAt,
    reset,
  } = useInterviewStore();

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

        case 'state': {
          const prevPhase = useInterviewStore.getState().phase;
          setPhase(msg.phase);
          setSpeaking(msg.speaking.who);
          if (msg.speaking.who === 'AI') {
            useInterviewStore.setState({ vad: false });
          }
          if (msg.speaking.who === 'CANDIDATE') {
            useInterviewStore.setState({ vad: true });
          }
          // If phase changed to an active phase, start the timer
          if (
            prevPhase === 'CREATED' &&
            ['INTRO', 'QUESTIONING', 'WRAP_UP'].includes(msg.phase)
          ) {
            setTimerStartedAt(Date.now());
          }
          // When AI finishes speaking and we have AI text
          const currentAiText = useInterviewStore.getState().aiPartialText;
          if (msg.speaking.who === 'NONE' && currentAiText) {
            addTranscript({
              turnId: msg.t.toString(),
              role: 'AI',
              text: currentAiText,
              isFinal: true,
              timestamp: msg.t,
            });
          }
          break;
        }

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
    [],
  );

  useEffect(() => {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    room.on(RoomEvent.DataReceived, (data) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(data));
        handleAgentMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity.startsWith('agent_')
      ) {
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
      setConnectionQuality('excellent');
    });

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      setConnectionQuality('poor');
    });

    room.on(RoomEvent.ConnectionQualityChanged, (_quality, participant) => {
      if (participant.isLocal) {
        const q = Number(_quality);
        if (q >= 3) setConnectionQuality('excellent');
        else if (q >= 2) setConnectionQuality('good');
        else setConnectionQuality('poor');
      }
    });

    room
      .connect(LIVEKIT_URL, token)
      .then(async () => {
        // Only enable mic if the participant has publish permissions (candidates, not recruiters)
        if (room.localParticipant.permissions?.canPublish) {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicMuted(false);
        }
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

  const sendClientEvent = useCallback(
    (action: 'start' | 'pause' | 'stop' | 'ping') => {
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
    },
    [],
  );

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return;
    const current = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!current);
    setIsMicMuted(current);
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    useInterviewStore.setState({ volume });
  }, []);

  return (
    <InterviewRoomContext.Provider value={{ sendClientEvent, toggleMic, setVolume }}>
      {children}
    </InterviewRoomContext.Provider>
  );
}
