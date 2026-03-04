import { voice, llm } from '@livekit/agents';
import pino from 'pino';
import {
  InterviewPhase,
  buildOrchestratorSystemPrompt,
  buildIntroMessage,
  buildOutroMessage,
  type InterviewLanguage,
  type OrchestratorPromptContext,
} from '@smarthirink/core';
import type { ContextManager } from '@smarthirink/rag';

const logger = pino({ name: 'interview-agent' });

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
  language: string; // 'en' | 'vi'
}

interface TurnRecord {
  role: 'AI' | 'CANDIDATE';
  text: string;
}

/**
 * InterviewVoiceAgent — a LiveKit voice.Agent that conducts AI interviews.
 *
 * Lifecycle (handled by the framework's AgentSession):
 * 1. Agent worker receives job dispatch from LiveKit server
 * 2. AgentSession connects to room and sets up streaming STT → LLM → TTS pipeline
 * 3. onEnter() speaks the intro greeting
 * 4. Each candidate utterance flows: mic → STT → onUserTurnCompleted (RAG + state) → LLM → TTS → speaker
 * 5. After enough questions, onUserTurnCompleted speaks outro and shuts down
 */
export class InterviewVoiceAgent extends voice.Agent {
  public readonly sessionInfo: SessionInfo;
  private turns: TurnRecord[] = [];
  private currentQuestionIndex = 0;
  private phase: InterviewPhase = InterviewPhase.WAITING;
  private contextManager?: ContextManager;
  private interviewEnded = false;

  // Callbacks for external persistence (non-blocking)
  public onTurnComplete?: (turn: {
    index: number;
    role: 'AI' | 'CANDIDATE';
    text: string;
    latency: { sttMs?: number; llmTtftMs?: number; ttsFirstAudioMs?: number; e2eMs?: number };
  }) => void;

  public onPhaseChange?: (phase: InterviewPhase) => void;
  public onSessionComplete?: () => void;

  constructor(sessionInfo: SessionInfo, contextManager?: ContextManager) {
    const lang = (sessionInfo.language as InterviewLanguage) || 'en';
    const promptCtx: OrchestratorPromptContext = {
      position: sessionInfo.position,
      level: sessionInfo.level,
      domain: sessionInfo.domain,
      topics: sessionInfo.topics,
      candidateName: sessionInfo.candidateName,
      candidateSummary: sessionInfo.candidateSummary,
      questionCount: sessionInfo.questionCount,
      previousTurns: [],
      currentQuestionIndex: 0,
      language: lang,
    };

    super({
      instructions: buildOrchestratorSystemPrompt(promptCtx),
    });

    this.sessionInfo = sessionInfo;
    this.contextManager = contextManager;
  }

  /** Called when the agent becomes the active agent in a session. */
  override async onEnter(): Promise<void> {
    this.setPhase(InterviewPhase.IN_PROGRESS);

    // Speak the full intro as a single TTS call to avoid multiple WebSocket roundtrips
    const lang = (this.sessionInfo.language as InterviewLanguage) || 'en';
    const intro = buildIntroMessage(
      this.sessionInfo.candidateName,
      this.sessionInfo.position,
      lang,
    );

    this.session.say(intro, { addToChatCtx: true, allowInterruptions: true });

    // Record as a turn
    this.turns.push({ role: 'AI', text: intro });
    this.onTurnComplete?.({ index: 0, role: 'AI', text: intro, latency: {} });
  }

  /**
   * Called after the user completes a turn, BEFORE the LLM generates a response.
   * We use this to:
   * - Record the candidate's utterance
   * - Inject RAG context (ephemeral)
   * - Track question progress
   * - End the interview when enough questions have been asked
   *
   * Throwing StopResponse prevents the LLM from generating a reply.
   */
  override async onUserTurnCompleted(
    _chatCtx: llm.ChatContext,
    _newMessage: llm.ChatMessage,
  ): Promise<void> {
    if (this.interviewEnded) {
      throw new voice.StopResponse();
    }

    const userText = _newMessage.textContent || '';
    if (!userText.trim()) return;

    // Record candidate turn
    this.turns.push({ role: 'CANDIDATE', text: userText });
    this.onTurnComplete?.({
      index: this.turns.length - 1,
      role: 'CANDIDATE',
      text: userText,
      latency: {},
    });

    // Check if we should wrap up the interview
    if (this.currentQuestionIndex >= this.sessionInfo.questionCount) {
      this.interviewEnded = true;
      const lang = (this.sessionInfo.language as InterviewLanguage) || 'en';
      const outro = buildOutroMessage(this.sessionInfo.candidateName, lang);
      this.session.say(outro, { addToChatCtx: true });
      this.turns.push({ role: 'AI', text: outro });
      this.onTurnComplete?.({
        index: this.turns.length - 1,
        role: 'AI',
        text: outro,
        latency: {},
      });

      this.setPhase(InterviewPhase.COMPLETED);
      this.onSessionComplete?.();

      // Allow outro to finish speaking before closing
      setTimeout(() => {
        this.session.close().catch(() => {});
      }, 8000);

      throw new voice.StopResponse();
    }

    // --- RAG Context Injection (ephemeral — not persisted) ---
    if (this.contextManager) {
      try {
        const ragContext = await this.contextManager.retrieve(userText, {
          topK: 3,
          sourceType: 'question_bank',
        });
        if (ragContext) {
          _chatCtx.addMessage({
            role: 'system',
            content: `Reference context for this question:\n${ragContext}`,
          });
        }
      } catch (err) {
        logger.warn({ err }, 'RAG retrieval failed');
      }
    }

    // --- Inject Dynamic Question Progress ---
    const progress = `You are now asking question ${this.currentQuestionIndex + 1} of ${this.sessionInfo.questionCount}.`;
    const isLastQuestion = this.currentQuestionIndex + 1 >= this.sessionInfo.questionCount;
    const lastHint = isLastQuestion
      ? ' This is the last question. After this response, the interview will conclude.'
      : '';

    _chatCtx.addMessage({
      role: 'system',
      content: progress + lastHint,
    });

    this.currentQuestionIndex++;

    // Let the default pipeline handle LLM → TTS streaming
    // The framework will:
    // 1. Send chatCtx to LLM (streaming)
    // 2. Stream LLM tokens to TTS (streaming)
    // 3. Stream TTS audio to the room
    // All fully pipelined with no buffering
  }

  /**
   * Override llmNode to capture the AI response text for turn tracking.
   * We wrap the default stream to accumulate the full response from ChatChunk deltas.
   */
  override async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const stream = await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);
    if (!stream) return null;

    let fullText = '';
    const self = this;

    return new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (fullText.trim()) {
                self.turns.push({ role: 'AI', text: fullText.trim() });
                self.onTurnComplete?.({
                  index: self.turns.length - 1,
                  role: 'AI',
                  text: fullText.trim(),
                  latency: {},
                });
              }
              controller.close();
              break;
            }
            // Extract text from ChatChunk delta
            if (typeof value === 'object' && value !== null && 'delta' in value) {
              const content = (value as llm.ChatChunk).delta?.content;
              if (content) fullText += content;
            } else if (typeof value === 'string') {
              fullText += value;
            }
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  private setPhase(phase: InterviewPhase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
    logger.info({ phase, sessionId: this.sessionInfo.sessionId }, 'Phase changed');
  }
}
