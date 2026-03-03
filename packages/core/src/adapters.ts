// ─── STT Adapter ─────────────────────────────────────────
export interface SttPartialResult {
  text: string;
  isFinal: false;
  confidence?: number;
  language?: string;
}

export interface SttFinalResult {
  text: string;
  isFinal: true;
  confidence: number;
  language?: string;
  durationMs: number;
}

export type SttResult = SttPartialResult | SttFinalResult;

export interface SttAdapter {
  readonly name: string;

  /**
   * Start a streaming recognition session.
   * Returns an object with methods to push audio and get results.
   */
  createStream(options: {
    sampleRate: number;
    channels: number;
    languageHints?: string[];
  }): SttStream;
}

export interface SttStream {
  /** Push raw PCM audio frames (Int16 LE). */
  pushAudio(frames: Buffer): void;

  /** Register callback for partial/final results. */
  onResult(cb: (result: SttResult) => void): void;

  /** Register error callback. */
  onError(cb: (err: Error) => void): void;

  /** Signal end of audio. */
  close(): Promise<void>;
}

// ─── LLM Adapter ─────────────────────────────────────────
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmStreamToken {
  text: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | null;
}

export interface LlmAdapter {
  readonly name: string;

  /**
   * Streaming completion. Yields tokens as they arrive.
   */
  streamCompletion(
    messages: LlmMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
    },
  ): AsyncIterable<LlmStreamToken>;

  /**
   * Single-shot completion (for evaluator, etc.).
   */
  complete(
    messages: LlmMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json';
    },
  ): Promise<string>;
}

// ─── TTS Adapter ─────────────────────────────────────────
export interface TtsAdapter {
  readonly name: string;

  /**
   * Stream synthesis: yields PCM audio chunks as they're generated.
   */
  synthesizeStream(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      sampleRate?: number;
    },
  ): AsyncIterable<Buffer>;

  /**
   * Full synthesis (returns complete buffer).
   */
  synthesize(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      sampleRate?: number;
      format?: 'pcm' | 'mp3' | 'opus';
    },
  ): Promise<Buffer>;
}

// ─── Embedding Adapter ───────────────────────────────────
export interface EmbeddingAdapter {
  readonly name: string;
  readonly dimensions: number;

  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

// ─── Evaluator Adapter ───────────────────────────────────
export interface EvaluationInput {
  transcript: Array<{ role: 'AI' | 'CANDIDATE'; text: string }>;
  candidateSummary: string;
  jobDescription: string;
  rubricCriteria: Array<{
    name: string;
    description: string;
    maxScore: number;
    weight: number;
  }>;
}

export interface CriterionEvaluation {
  criterionName: string;
  score: number;
  maxScore: number;
  evidence: string;
  reasoning: string;
}

export interface EvaluationResult {
  criterionScores: CriterionEvaluation[];
  overallScore: number;
  maxPossibleScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'STRONG_NO';
}

export interface EvaluatorAdapter {
  readonly name: string;

  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
