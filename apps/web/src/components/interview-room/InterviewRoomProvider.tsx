'use client';

import { createContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { useInterviewStore } from '@/lib/store';

export interface InterviewRoomContextValue {
  sendClientEvent: (action: 'start' | 'pause' | 'stop' | 'ping') => void;
  toggleMic: () => Promise<void>;
  setVolume: (volume: number) => void;
  canPlaybackAudio?: boolean;
  startAudio?: () => void;
}

export const InterviewRoomContext = createContext<InterviewRoomContextValue | null>(null);

interface Props {
  sessionId: string;
  roomName?: string;
  onSessionComplete?: () => void;
  children: ReactNode;
}

/**
 * Connects to the Pipecat interview agent via native WebRTC (SmallWebRTCTransport).
 *
 * Signaling flow:
 * 1. Browser creates RTCPeerConnection + SDP offer
 * 2. POST /api/interviews/:id/offer → proxied to Pipecat agent → SDP answer
 * 3. ICE candidates trickled via PATCH /api/interviews/:id/offer
 * 4. Audio flows peer-to-peer: browser mic → agent STT → LLM → TTS → browser speakers
 * 5. Transcripts & state arrive via WebRTC data channel
 */
export function InterviewRoomProvider({ sessionId, onSessionComplete, children }: Props) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;
  const [canPlaybackAudio, setCanPlaybackAudio] = useState(true);

  const {
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

  /**
   * Handle messages from the Pipecat agent via WebRTC data channel.
   * Message types: 'transcript' (STT/LLM text) and 'state' (agent status).
   */
  const handleAgentMessage = useCallback(
    (msg: any) => {
      if (msg.type === 'transcript') {
        if (msg.role === 'AI') {
          if (msg.isFinal) {
            addTranscript({
              turnId: `ai-${msg.turnIndex ?? Date.now()}`,
              role: 'AI',
              text: msg.text,
              isFinal: true,
              timestamp: Date.now(),
            });
            setAiPartialText('');
          } else {
            setAiPartialText(msg.text);
          }
        } else {
          // CANDIDATE
          if (msg.isFinal) {
            addTranscript({
              turnId: `cand-${msg.turnIndex ?? Date.now()}`,
              role: 'CANDIDATE',
              text: msg.text,
              isFinal: true,
              timestamp: Date.now(),
            });
            setCandidatePartialText('');
          } else {
            setCandidatePartialText(msg.text);
            setSpeaking('CANDIDATE');
            useInterviewStore.setState({ vad: true });
          }
        }
      } else if (msg.type === 'state') {
        if (msg.speaking === 'AI') {
          setSpeaking('AI');
          useInterviewStore.setState({ vad: false });
        } else if (msg.speaking === 'NONE') {
          setSpeaking('NONE');
        }

        if (msg.phase === 'IN_PROGRESS') {
          const prevPhase = useInterviewStore.getState().phase;
          if (prevPhase === 'CREATED' || prevPhase === 'WAITING') {
            setPhase('IN_PROGRESS');
            setTimerStartedAt(Date.now());
          }
        } else if (msg.phase === 'COMPLETED') {
          setPhase('COMPLETED');
          onSessionCompleteRef.current?.();
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        // 1. Get user media (microphone)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        audioTrackRef.current = audioTrack;

        // 2. Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Track ICE candidates to send after we get pc_id from answer
        let pcId: string | null = null;
        let canSendIce = false;
        const pendingCandidates: RTCIceCandidate[] = [];

        const sendIceCandidate = async (candidate: RTCIceCandidate) => {
          await fetch(`/api/interviews/${sessionId}/offer`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pc_id: pcId,
              candidates: [{
                candidate: candidate.candidate,
                sdp_mid: candidate.sdpMid,
                sdp_mline_index: candidate.sdpMLineIndex,
              }],
            }),
          });
        };

        // 3. ICE candidate handler (trickle)
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            if (canSendIce && pcId) {
              await sendIceCandidate(event.candidate);
            } else {
              pendingCandidates.push(event.candidate);
            }
          }
        };

        // 4. Connection state monitoring
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') {
            setConnected(true);
            setConnectionQuality('excellent');
            setIsMicMuted(false);
          } else if (state === 'disconnected' || state === 'failed') {
            setConnected(false);
            setConnectionQuality('poor');
          }
        };

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          if (state === 'connected' || state === 'completed') {
            setConnectionQuality('excellent');
          } else if (state === 'checking') {
            setConnectionQuality('good');
          } else if (state === 'disconnected') {
            setConnectionQuality('poor');
          }
        };

        // 5. Handle remote audio track (agent speech)
        pc.ontrack = (event) => {
          if (event.track.kind === 'audio') {
            const audioElement = new Audio();
            audioElement.srcObject = event.streams[0];
            audioElement.autoplay = true;
            audioElement.play().then(() => {
              setCanPlaybackAudio(true);
            }).catch(() => {
              setCanPlaybackAudio(false);
            });
            audioRef.current = audioElement;
          }
        };

        // 6. Add audio transceiver (send mic, receive agent)
        pc.addTransceiver(audioTrack, { direction: 'sendrecv' });
        // Video transceiver required by Pipecat SmallWebRTCTransport
        pc.addTransceiver('video', { direction: 'sendrecv' });

        // 7. Create data channel for bidirectional messages with agent
        // Browser must create the channel — Pipecat listens via on("datachannel")
        const dc = pc.createDataChannel('chat', { ordered: true });
        dcRef.current = dc;
        dc.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            handleAgentMessage(msg);
          } catch {
            // Ignore non-JSON messages
          }
        };

        // 8. Create SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (cancelled) return;

        // 9. Send offer to Pipecat agent (via API proxy)
        const response = await fetch(`/api/interviews/${sessionId}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp: pc.localDescription!.sdp,
            type: pc.localDescription!.type,
            session_id: sessionId,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: 'Connection failed' }));
          throw new Error(err.detail || `Agent error: ${response.status}`);
        }

        const answer = await response.json();
        pcId = answer.pc_id;

        // 10. Set remote description (SDP answer)
        await pc.setRemoteDescription(new RTCSessionDescription({
          sdp: answer.sdp,
          type: answer.type,
        }));

        // 11. Flush pending ICE candidates
        canSendIce = true;
        for (const candidate of pendingCandidates) {
          await sendIceCandidate(candidate);
        }
        pendingCandidates.length = 0;

        setConnected(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(`Failed to connect: ${err.message}`);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      pcRef.current?.close();
      audioTrackRef.current?.stop();
      audioRef.current?.pause();
      dcRef.current?.close();
      reset();
    };
  }, [sessionId]);

  const sendClientEvent = useCallback(
    (action: 'start' | 'pause' | 'stop' | 'ping') => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') return;
      dc.send(JSON.stringify({
        type: 'client_event',
        action,
        t: Date.now(),
      }));
    },
    [],
  );

  const toggleMic = useCallback(async () => {
    const track = audioTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicMuted(!track.enabled);
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    useInterviewStore.setState({ volume });
  }, []);

  const startAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setCanPlaybackAudio(true);
      }).catch(() => {});
    }
  }, []);

  return (
    <InterviewRoomContext.Provider value={{ sendClientEvent, toggleMic, setVolume, canPlaybackAudio, startAudio }}>
      {children}
    </InterviewRoomContext.Provider>
  );
}
