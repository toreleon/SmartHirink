import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Track,
  DataPacket_Kind,
  LocalParticipant,
} from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';
import pino from 'pino';
import { randomUUID } from 'crypto';
import {
  InterviewPhase,
  SpeakingParty,
  buildOrchestratorSystemPrompt,
  buildOrchestratorUserMessage,
  buildIntroMessage,
  buildOutroMessage,
  type SttAdapter,
  type SttStream,
  type SttResult,
  type LlmAdapter,
  type TtsAdapter,
  type AgentDataMessage,
  type OrchestratorPromptContext,
} from '@smarthirink/core';
import type { ContextManager } from '@smarthirink/rag';

const logger = pino({ name: 'interview-agent' });

export interface AgentDependencies {
  stt: SttAdapter;
  llm: LlmAdapter;
  tts: TtsAdapter;
  contextManager?: ContextManager;
}

export interface SessionInfo {
  sessionId: string;
  roomName: string;
  candidateId: string;
  candidateName: string;
  candidateSummary: string;
  position: string;
  level: string;
  domain: string;
  topics: string[];
  questionCount: number;
  jobDescription: string;
}

interface TurnRecord {
  role: 'AI' | 'CANDIDATE';
  text: string;
}

/**
 * InterviewAgent — joins a LiveKit room as the AI participant.
 *
 * Lifecycle:
 * 1. Connect to room as `agent_<sessionId>`
 * 2. Wait for candidate to join and publish mic
 * 3. Subscribe to candidate mic → pipe audio into STT stream
 * 4. On STT final → run LLM (streamed) → run TTS (streamed) → publish audio
 * 5. All transcript/state messages sent via data channel
 * 6. Persist turns to DB asynchronously (via BullMQ or direct)
 */
export class InterviewAgent {
  private room: Room;
  private deps: AgentDependencies;
  private session: SessionInfo;
  private turns: TurnRecord[] = [];
  private currentQuestionIndex = 0;
  private phase: InterviewPhase = InterviewPhase.CREATED;
  private sttStream: SttStream | null = null;
  private isProcessing = false;
  private abortController: AbortController | null = null;

  // Callbacks for external persistence (non-blocking)
  public onTurnComplete?: (turn: {
    index: number;
    role: 'AI' | 'CANDIDATE';
    text: string;
    latency: { sttMs?: number; llmTtftMs?: number; ttsFirstAudioMs?: number; e2eMs?: number };
  }) => void;

  public onPhaseChange?: (phase: InterviewPhase) => void;
  public onSessionComplete?: () => void;

  constructor(deps: AgentDependencies, session: SessionInfo) {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.deps = deps;
    this.session = session;
  }

  /** Connect to LiveKit room and start agent loop. */
  async connect(livekitUrl: string, apiKey: string, apiSecret: string): Promise<void> {
    const identity = `agent_${this.session.sessionId}`;

    // Mint token for agent
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '4h',
    });

    at.addGrant({
      room: this.session.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // Set up event handlers before connecting
    this.setupRoomEvents();

    logger.info({ room: this.session.roomName, identity }, 'Connecting to LiveKit room');
    await this.room.connect(livekitUrl, token);
    logger.info('Connected to LiveKit room');

    this.setPhase(InterviewPhase.WAITING);
  }

  private setupRoomEvents(): void {
    // When candidate publishes mic track, start STT
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity.startsWith('candidate_')
      ) {
        logger.info({ participant: participant.identity }, 'Candidate audio track subscribed');
        this.handleCandidateAudio(track as any);
      }
    });

    // When candidate joins
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity.startsWith('candidate_')) {
        logger.info({ participant: participant.identity }, 'Candidate joined');
        if (this.phase === InterviewPhase.WAITING) {
          this.startInterview();
        }
      }
    });

    // Data messages from candidate
    this.room.on(RoomEvent.DataReceived, (data, participant) => {
      if (participant?.identity.startsWith('candidate_')) {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));
          this.handleClientMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      }
    });

    // Handle disconnections
    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity.startsWith('candidate_')) {
        logger.warn('Candidate disconnected');
        // Allow 60s for reconnect before ending
        setTimeout(() => {
          if (this.phase !== InterviewPhase.COMPLETED && this.phase !== InterviewPhase.CANCELLED) {
            const candidates = Array.from(this.room.remoteParticipants.values()).filter((p) =>
              p.identity.startsWith('candidate_'),
            );
            if (candidates.length === 0) {
              logger.info('Candidate did not reconnect, ending session');
              this.endSession();
            }
          }
        }, 60000);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      logger.warn('Agent disconnected from room');
    });
  }

  /** Handle candidate audio — pipe into STT. */
  private handleCandidateAudio(track: any): void {
    this.sttStream = this.deps.stt.createStream({
      sampleRate: 48000,
      channels: 1,
      languageHints: ['vi', 'en'],
    });

    let sttStartTime = 0;
    let partialText = '';
    const turnId = randomUUID();

    this.sttStream.onResult((result: SttResult) => {
      if (!result.isFinal) {
        partialText = result.text;
        this.sendDataMessage({
          type: 'partial_transcript',
          turnId,
          text: result.text,
          isFinal: false,
          t: Date.now(),
        });
      } else {
        const sttLatencyMs = sttStartTime ? Date.now() - sttStartTime : undefined;

        this.sendDataMessage({
          type: 'final_transcript',
          turnId,
          text: result.text,
          isFinal: true,
          t: Date.now(),
        });

        if (result.text.trim()) {
          this.processCandidateUtterance(result.text.trim(), sttLatencyMs);
        }
        partialText = '';
      }
    });

    this.sttStream.onError((err) => {
      logger.error({ err }, 'STT error');
      this.sendDataMessage({
        type: 'error',
        code: 'STT_ERROR',
        message: 'Speech recognition error',
        recoverable: true,
        t: Date.now(),
      });
    });

    // Pipe audio frames from WebRTC track to STT
    // In livekit-client for Node, we attach an audio frame handler
    const mediaStream = track.mediaStream;
    if (mediaStream) {
      // Use Web Audio API or direct PCM access
      // For Node.js, we handle raw audio frames
      const interval = setInterval(() => {
        // This is a simplified representation.
        // In production, use livekit's onAudioFrame callback or AudioStream.
        // The actual implementation depends on the livekit-client Node.js binding.
        sttStartTime = Date.now();
      }, 20); // 20ms frame interval

      // Store cleanup ref
      (this as any)._audioInterval = interval;
    }
  }

  /** Process a final candidate utterance through the LLM → TTS pipeline. */
  private async processCandidateUtterance(text: string, sttLatencyMs?: number): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Already processing, queuing utterance');
      return;
    }

    this.isProcessing = true;
    const e2eStart = Date.now();

    try {
      // Record candidate turn
      this.turns.push({ role: 'CANDIDATE', text });
      const candidateTurnIndex = this.turns.length - 1;

      this.onTurnComplete?.({
        index: candidateTurnIndex,
        role: 'CANDIDATE',
        text,
        latency: { sttMs: sttLatencyMs },
      });

      // Update state: AI thinking
      this.sendStateMessage(SpeakingParty.AI);

      // ─── RAG Context (non-blocking fetch) ───────────────
      let ragContext = '';
      if (this.deps.contextManager) {
        try {
          ragContext = await this.deps.contextManager.retrieve(text, {
            topK: 3,
            sourceType: 'question_bank',
          });
        } catch (err) {
          logger.warn({ err }, 'RAG retrieval failed, continuing without context');
        }
      }

      // ─── LLM Streaming ─────────────────────────────────
      const promptCtx: OrchestratorPromptContext = {
        position: this.session.position,
        level: this.session.level,
        domain: this.session.domain,
        topics: this.session.topics,
        candidateName: this.session.candidateName,
        candidateSummary: this.session.candidateSummary,
        questionCount: this.session.questionCount,
        previousTurns: this.turns,
        currentQuestionIndex: this.currentQuestionIndex,
        retrievedContext: ragContext || undefined,
      };

      const systemPrompt = buildOrchestratorSystemPrompt(promptCtx);
      const userMsg = buildOrchestratorUserMessage(this.turns.slice(0, -1), text);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMsg },
      ];

      let llmTtftMs: number | undefined;
      const llmStart = Date.now();
      let aiFullText = '';
      const turnId = randomUUID();

      // Collect streamed tokens → accumulate for TTS sentence chunks
      let sentenceBuffer = '';
      const sentenceEndRegex = /[.!?。！？]\s*/;

      for await (const token of this.deps.llm.streamCompletion(messages)) {
        if (!llmTtftMs) {
          llmTtftMs = Date.now() - llmStart;
        }
        aiFullText += token.text;
        sentenceBuffer += token.text;

        // Send partial AI text via data channel
        this.sendDataMessage({
          type: 'ai_text',
          turnId,
          text: aiFullText,
          t: Date.now(),
        });

        // When we have a complete sentence, start TTS for that chunk
        if (sentenceEndRegex.test(sentenceBuffer)) {
          const sentenceToSpeak = sentenceBuffer.trim();
          sentenceBuffer = '';
          if (sentenceToSpeak) {
            // Fire-and-forget TTS for this sentence chunk (streaming)
            await this.speakText(sentenceToSpeak);
          }
        }
      }

      // Speak any remaining buffer
      if (sentenceBuffer.trim()) {
        await this.speakText(sentenceBuffer.trim());
      }

      // Record AI turn
      this.turns.push({ role: 'AI', text: aiFullText });
      this.currentQuestionIndex++;

      const e2eMs = Date.now() - e2eStart;

      this.onTurnComplete?.({
        index: this.turns.length - 1,
        role: 'AI',
        text: aiFullText,
        latency: { sttMs: sttLatencyMs, llmTtftMs, e2eMs },
      });

      // Check if we should wrap up
      if (this.currentQuestionIndex >= this.session.questionCount) {
        this.setPhase(InterviewPhase.WRAP_UP);
        const outro = buildOutroMessage(this.session.candidateName);
        await this.speakText(outro);
        this.turns.push({ role: 'AI', text: outro });
        await this.endSession();
      } else {
        this.sendStateMessage(SpeakingParty.NONE);
      }
    } catch (err) {
      logger.error({ err }, 'Error processing utterance');
      this.sendDataMessage({
        type: 'error',
        code: 'PROCESSING_ERROR',
        message: 'Error generating response',
        recoverable: true,
        t: Date.now(),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /** Synthesize and publish audio for a text chunk. */
  private async speakText(text: string): Promise<void> {
    try {
      const ttsStart = Date.now();
      let firstChunk = true;

      for await (const audioChunk of this.deps.tts.synthesizeStream(text)) {
        if (firstChunk) {
          const ttsFirstAudioMs = Date.now() - ttsStart;
          logger.debug({ ttsFirstAudioMs }, 'TTS first audio chunk');
          firstChunk = false;
        }
        // Publish audio chunk to room
        // In production, create a LocalAudioTrack from PCM frames
        // and publish it via room.localParticipant.publishTrack()
        await this.publishAudioChunk(audioChunk);
      }
    } catch (err) {
      logger.error({ err }, 'TTS error');
    }
  }

  /** Publish raw PCM audio chunk to the LiveKit room. */
  private async publishAudioChunk(pcmData: Buffer): Promise<void> {
    // In a real implementation, you'd maintain a persistent LocalAudioTrack
    // and feed PCM frames into it via an AudioSource.
    // This is a simplified placeholder showing the pattern:
    //
    // const audioSource = new AudioSource(24000, 1);
    // const track = LocalAudioTrack.createAudioTrack('ai-voice', audioSource);
    // await this.room.localParticipant.publishTrack(track);
    // audioSource.captureFrame(new AudioFrame(pcmData, 24000, 1, pcmData.length / 2));
    //
    // For now, we log that we would publish.
    logger.trace({ bytes: pcmData.length }, 'Publishing audio chunk');
  }

  /** Start the interview with an intro message. */
  private async startInterview(): Promise<void> {
    this.setPhase(InterviewPhase.INTRO);

    const intro = buildIntroMessage(this.session.candidateName, this.session.position);
    await this.speakText(intro);

    this.turns.push({ role: 'AI', text: intro });
    this.onTurnComplete?.({
      index: 0,
      role: 'AI',
      text: intro,
      latency: {},
    });

    this.setPhase(InterviewPhase.QUESTIONING);
  }

  /** End the interview session. */
  private async endSession(): Promise<void> {
    this.setPhase(InterviewPhase.COMPLETED);

    this.sendDataMessage({
      type: 'session_complete',
      sessionId: this.session.sessionId,
      t: Date.now(),
    });

    this.onSessionComplete?.();

    // Cleanup
    this.sttStream?.close();
    if ((this as any)._audioInterval) {
      clearInterval((this as any)._audioInterval);
    }

    // Disconnect after a brief delay
    setTimeout(() => {
      this.room.disconnect();
    }, 2000);
  }

  /** Handle client messages from data channel. */
  private handleClientMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'client_event') {
      switch (msg.action) {
        case 'stop':
          logger.info('Client requested stop');
          this.endSession();
          break;
        case 'pause':
          logger.info('Client requested pause');
          break;
        case 'ping':
          // Respond with state
          this.sendStateMessage(
            this.isProcessing ? SpeakingParty.AI : SpeakingParty.NONE,
          );
          break;
      }
    }
  }

  /** Send a data message to all participants. */
  private sendDataMessage(msg: AgentDataMessage): void {
    try {
      const encoded = new TextEncoder().encode(JSON.stringify(msg));
      this.room.localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      logger.warn({ err }, 'Failed to send data message');
    }
  }

  /** Send state update. */
  private sendStateMessage(speaking: SpeakingParty): void {
    this.sendDataMessage({
      type: 'state',
      phase: this.phase,
      speaking: { who: speaking },
      vad: false,
      t: Date.now(),
    });
  }

  /** Update phase and notify. */
  private setPhase(phase: InterviewPhase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
    this.sendStateMessage(SpeakingParty.NONE);
    logger.info({ phase }, 'Phase changed');
  }

  /** Graceful shutdown. */
  async disconnect(): Promise<void> {
    this.sttStream?.close();
    this.room.disconnect();
  }
}
