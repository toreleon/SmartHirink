import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  AudioSource,
  AudioFrame,
  AudioStream,
  TrackPublishOptions,
  TrackKind,
  TrackSource,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalParticipant,
} from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';
import pino from 'pino';
import { randomUUID } from 'crypto';
import {
  InterviewPhase,
  SpeakerRole,
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

// TTS output is 24kHz 16-bit mono PCM
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_FRAME_DURATION_MS = 20;
const TTS_SAMPLES_PER_FRAME = (TTS_SAMPLE_RATE * TTS_FRAME_DURATION_MS) / 1000;

// Utterance queue config
const MAX_UTTERANCE_QUEUE = 3;

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

interface QueuedUtterance {
  text: string;
  sttLatencyMs?: number;
}

/**
 * InterviewAgent — joins a LiveKit room as the AI participant using @livekit/rtc-node.
 *
 * Lifecycle:
 * 1. Connect to room as `agent_<sessionId>`
 * 2. Publish an AudioSource track for AI voice output
 * 3. Wait for candidate to join and publish mic
 * 4. Subscribe to candidate mic -> pipe raw PCM into STT stream via AudioStream
 * 5. On STT final -> run LLM (streamed) -> run TTS (streamed) -> publish audio frames
 * 6. All transcript/state messages sent via data channel
 * 7. Persist turns to DB asynchronously (via BullMQ)
 */
export class InterviewAgent {
  private room: Room;
  private deps: AgentDependencies;
  private session: SessionInfo;
  private turns: TurnRecord[] = [];
  private currentQuestionIndex = 0;
  private phase: InterviewPhase = InterviewPhase.CREATED;
  private sttStream: SttStream | null = null;
  private audioStreamReader: AudioStream | null = null;
  private isProcessing = false;
  private utteranceQueue: QueuedUtterance[] = [];
  private currentTrack: RemoteTrack | null = null;

  // Audio publishing resources
  private audioSource: AudioSource | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;

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
    this.room = new Room();
    this.deps = deps;
    this.session = session;
  }

  /** Connect to LiveKit room and start agent loop. */
  async connect(livekitUrl: string, apiKey: string, apiSecret: string): Promise<void> {
    const identity = `agent_${this.session.sessionId}`;

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

    this.setupRoomEvents();

    logger.info({ room: this.session.roomName, identity }, 'Connecting to LiveKit room');
    await this.room.connect(livekitUrl, token);
    logger.info('Connected to LiveKit room');

    await this.setupAudioPublishing();

    this.setPhase(InterviewPhase.WAITING);
  }

  /** Set up the AudioSource + LocalAudioTrack for publishing TTS audio. */
  private async setupAudioPublishing(): Promise<void> {
    this.audioSource = new AudioSource(TTS_SAMPLE_RATE, TTS_CHANNELS);
    this.localAudioTrack = LocalAudioTrack.createAudioTrack('ai-voice', this.audioSource);

    const publishOptions = new TrackPublishOptions();
    publishOptions.source = TrackSource.SOURCE_MICROPHONE;

    await this.room.localParticipant!.publishTrack(this.localAudioTrack, publishOptions);
    logger.info('Published AI audio track');
  }

  private setupRoomEvents(): void {
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (
          track.kind === TrackKind.KIND_AUDIO &&
          participant.identity.startsWith('candidate_')
        ) {
          logger.info({ participant: participant.identity }, 'Candidate audio track subscribed');
          this.currentTrack = track;
          this.handleCandidateAudio(track);
        }
      },
    );

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (participant.identity.startsWith('candidate_')) {
        logger.info({ participant: participant.identity }, 'Candidate joined');
        if (this.phase === InterviewPhase.WAITING) {
          this.startInterview();
        }
      }
    });

    this.room.on(
      RoomEvent.DataReceived,
      (data: Uint8Array, participant?: RemoteParticipant) => {
        if (participant?.identity.startsWith('candidate_')) {
          try {
            const msg = JSON.parse(new TextDecoder().decode(data));
            this.handleClientMessage(msg);
          } catch {
            // Ignore malformed messages
          }
        }
      },
    );

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (participant.identity.startsWith('candidate_')) {
        logger.warn('Candidate disconnected');
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

  /**
   * Handle candidate audio using AudioStream from @livekit/rtc-node.
   * Implements STT stream reconnection on error.
   */
  private handleCandidateAudio(track: RemoteTrack): void {
    this.createSttStream();

    let sttStartTime = 0;
    const turnId = randomUUID();

    // Create an AudioStream to iterate raw PCM frames from the remote track
    this.audioStreamReader = new AudioStream(track);

    (async () => {
      try {
        for await (const frame of this.audioStreamReader!) {
          sttStartTime = sttStartTime || Date.now();
          const pcmBuffer = Buffer.from(
            frame.data.buffer,
            frame.data.byteOffset,
            frame.data.byteLength,
          );
          this.sttStream?.pushAudio(pcmBuffer);
        }
      } catch (err) {
        logger.error({ err }, 'AudioStream iteration error');
      }
    })();
  }

  /** Create or recreate STT stream with reconnection on error. */
  private createSttStream(): void {
    this.sttStream = this.deps.stt.createStream({
      sampleRate: 48000,
      channels: 1,
      languageHints: ['vi', 'en'],
    });

    let sttStartTime = 0;
    const turnId = randomUUID();

    this.sttStream.onResult((result: SttResult) => {
      if (!result.isFinal) {
        this.sendDataMessage({
          type: 'partial_transcript',
          turnId,
          text: result.text,
          isFinal: false,
          t: Date.now(),
        });
      } else {
        const sttLatencyMs = sttStartTime ? Date.now() - sttStartTime : undefined;
        sttStartTime = 0;

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
      }
    });

    this.sttStream.onError((err) => {
      logger.error({ err }, 'STT error — attempting reconnection');
      this.sendDataMessage({
        type: 'error',
        code: 'STT_ERROR',
        message: 'Speech recognition error, reconnecting...',
        recoverable: true,
        t: Date.now(),
      });

      // Reconnect STT stream
      setTimeout(() => {
        try {
          this.createSttStream();
          logger.info('STT stream reconnected');
        } catch (reconnectErr) {
          logger.error({ err: reconnectErr }, 'STT reconnection failed');
        }
      }, 500);
    });
  }

  /**
   * Process a final candidate utterance through the LLM -> TTS pipeline.
   * Implements utterance queue: if already processing, queue the utterance.
   */
  private async processCandidateUtterance(text: string, sttLatencyMs?: number): Promise<void> {
    if (this.isProcessing) {
      // Queue utterance instead of dropping
      if (this.utteranceQueue.length < MAX_UTTERANCE_QUEUE) {
        logger.debug({ queueSize: this.utteranceQueue.length + 1 }, 'Queuing utterance');
        this.utteranceQueue.push({ text, sttLatencyMs });
      } else {
        logger.warn('Utterance queue full, dropping oldest');
        this.utteranceQueue.shift();
        this.utteranceQueue.push({ text, sttLatencyMs });
      }
      return;
    }

    this.isProcessing = true;
    const e2eStart = Date.now();
    let turnCompleted = false;

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
      this.sendStateMessage(SpeakerRole.AI);

      // --- RAG Context (non-blocking fetch) ---
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

      // --- LLM Streaming ---
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

      let sentenceBuffer = '';
      const sentenceEndRegex = /[.!?]\s*/;

      for await (const token of this.deps.llm.streamCompletion(messages)) {
        if (!llmTtftMs) {
          llmTtftMs = Date.now() - llmStart;
        }
        aiFullText += token.text;
        sentenceBuffer += token.text;

        this.sendDataMessage({
          type: 'ai_text',
          turnId,
          text: aiFullText,
          t: Date.now(),
        });

        if (sentenceEndRegex.test(sentenceBuffer)) {
          const sentenceToSpeak = sentenceBuffer.trim();
          sentenceBuffer = '';
          if (sentenceToSpeak) {
            await this.speakText(sentenceToSpeak);
          }
        }
      }

      // Speak any remaining buffer
      if (sentenceBuffer.trim()) {
        await this.speakText(sentenceBuffer.trim());
      }

      // Record AI turn — mark as completed
      turnCompleted = true;
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
        this.setPhase(InterviewPhase.IN_PROGRESS);
        const outro = buildOutroMessage(this.session.candidateName);
        await this.speakText(outro);
        this.turns.push({ role: 'AI', text: outro });
        await this.endSession();
      } else {
        this.sendStateMessage(SpeakerRole.AI);
      }
    } catch (err) {
      logger.error({ err }, 'Error processing utterance');

      // If turn was not completed, don't increment question index
      if (!turnCompleted) {
        logger.info('Turn not completed due to error, question index unchanged');
      }

      this.sendDataMessage({
        type: 'error',
        code: 'PROCESSING_ERROR',
        message: 'Error generating response. Retrying...',
        recoverable: true,
        t: Date.now(),
      });

      // Signal candidate can speak again
      this.sendStateMessage(SpeakerRole.AI);
    } finally {
      this.isProcessing = false;

      // Drain utterance queue
      if (this.utteranceQueue.length > 0) {
        const next = this.utteranceQueue.shift()!;
        logger.debug({ remaining: this.utteranceQueue.length }, 'Draining utterance queue');
        // Process next queued utterance (async, don't await to avoid blocking)
        this.processCandidateUtterance(next.text, next.sttLatencyMs);
      }
    }
  }

  /** Synthesize and publish audio for a text chunk using AudioSource.captureFrame. */
  private async speakText(text: string): Promise<void> {
    if (!this.audioSource) {
      logger.warn('AudioSource not initialized, cannot speak');
      return;
    }

    try {
      const ttsStart = Date.now();
      let firstChunk = true;
      let pcmBuffer = Buffer.alloc(0);

      for await (const audioChunk of this.deps.tts.synthesizeStream(text)) {
        if (firstChunk) {
          const ttsFirstAudioMs = Date.now() - ttsStart;
          logger.debug({ ttsFirstAudioMs }, 'TTS first audio chunk');
          firstChunk = false;
        }

        pcmBuffer = Buffer.concat([pcmBuffer, audioChunk]);

        const frameSizeBytes = TTS_SAMPLES_PER_FRAME * 2;
        while (pcmBuffer.length >= frameSizeBytes) {
          const frameData = pcmBuffer.subarray(0, frameSizeBytes);
          pcmBuffer = pcmBuffer.subarray(frameSizeBytes);

          const samples = new Int16Array(
            frameData.buffer,
            frameData.byteOffset,
            frameData.byteLength / 2,
          );

          const audioFrame = new AudioFrame(
            samples,
            TTS_SAMPLE_RATE,
            TTS_CHANNELS,
            TTS_SAMPLES_PER_FRAME,
          );

          await this.audioSource!.captureFrame(audioFrame);
        }
      }

      // Flush any remaining partial frame (pad with silence)
      if (pcmBuffer.length > 0) {
        const padded = Buffer.alloc(TTS_SAMPLES_PER_FRAME * 2, 0);
        pcmBuffer.copy(padded);
        const samples = new Int16Array(
          padded.buffer,
          padded.byteOffset,
          padded.byteLength / 2,
        );
        const audioFrame = new AudioFrame(
          samples,
          TTS_SAMPLE_RATE,
          TTS_CHANNELS,
          TTS_SAMPLES_PER_FRAME,
        );
        await this.audioSource!.captureFrame(audioFrame);
      }
    } catch (err) {
      logger.error({ err }, 'TTS error');
    }
  }

  /** Start the interview with an intro message. */
  private async startInterview(): Promise<void> {
    this.setPhase(InterviewPhase.IN_PROGRESS);

    const intro = buildIntroMessage(this.session.candidateName, this.session.position);
    await this.speakText(intro);

    this.turns.push({ role: 'AI', text: intro });
    this.onTurnComplete?.({
      index: 0,
      role: 'AI',
      text: intro,
      latency: {},
    });

    this.setPhase(InterviewPhase.IN_PROGRESS);
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

    await this.sttStream?.close();
    this.audioStreamReader?.close();

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
          this.sendStateMessage(
            this.isProcessing ? SpeakerRole.AI : SpeakerRole.AI,
          );
          break;
      }
    }
  }

  /** Send a data message to all participants. */
  private sendDataMessage(msg: AgentDataMessage): void {
    try {
      const encoded = new TextEncoder().encode(JSON.stringify(msg));
      this.room.localParticipant?.publishData(encoded, { reliable: true });
    } catch (err) {
      logger.warn({ err }, 'Failed to send data message');
    }
  }

  /** Send state update. */
  private sendStateMessage(speaking: SpeakerRole): void {
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
    this.sendStateMessage(SpeakerRole.AI);
    logger.info({ phase }, 'Phase changed');
  }

  /** Graceful shutdown. */
  async disconnect(): Promise<void> {
    await this.sttStream?.close();
    this.audioStreamReader?.close();
    await this.room.disconnect();
  }
}
