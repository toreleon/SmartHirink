// ─── Role & Auth ─────────────────────────────────────────
export enum UserRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  CANDIDATE = 'CANDIDATE',
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── Interview Domain ────────────────────────────────────
export enum InterviewPhase {
  CREATED = 'CREATED',
  WAITING = 'WAITING', // room created, waiting for candidate
  INTRO = 'INTRO',
  QUESTIONING = 'QUESTIONING',
  WRAP_UP = 'WRAP_UP',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SpeakingParty {
  CANDIDATE = 'CANDIDATE',
  AI = 'AI',
  NONE = 'NONE',
}

export interface CandidateProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  resumeText?: string;
  skills: string[];
  experienceYears: number;
  createdAt: Date;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  position: string; // e.g. "Backend Engineer"
  level: string; // e.g. "Mid-level"
  domain: string; // e.g. "Software Engineering"
  topics: string[];
  questionCount: number;
  durationMinutes: number;
  createdById: string;
  createdAt: Date;
}

export interface RubricCriterion {
  id: string;
  rubricId: string;
  name: string; // e.g. "Technical Depth"
  description: string;
  maxScore: number;
  weight: number; // 0-1
}

export interface Rubric {
  id: string;
  scenarioId: string;
  criteria: RubricCriterion[];
  createdAt: Date;
}

export interface InterviewSession {
  id: string;
  scenarioId: string;
  rubricId: string;
  candidateId: string;
  recruiterId: string;
  livekitRoom: string; // "interview_<sessionId>"
  phase: InterviewPhase;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

export interface Turn {
  id: string;
  sessionId: string;
  index: number;
  speakerRole: 'AI' | 'CANDIDATE';
  transcript: string;
  audioUrl?: string;
  sttLatencyMs?: number;
  llmTtftMs?: number;
  ttsFirstAudioMs?: number;
  e2eLatencyMs?: number;
  startedAt: Date;
  endedAt?: Date;
}

export interface CriterionScore {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  evidence: string; // quote from transcript
  reasoning: string;
}

export interface ScoreCard {
  id: string;
  sessionId: string;
  overallScore: number;
  maxPossibleScore: number;
  criterionScores: CriterionScore[];
  strengths: string[];
  weaknesses: string[];
  recommendation: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'STRONG_NO';
  evaluatedAt: Date;
}

export interface Report {
  id: string;
  sessionId: string;
  scoreCardId: string;
  pdfUrl?: string;
  generatedAt: Date;
}

export interface ModelConfig {
  id: string;
  name: string;
  sttProvider: string;
  sttModel?: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  ttsVoice?: string;
  embeddingProvider: string;
  embeddingModel: string;
  isDefault: boolean;
  createdAt: Date;
}
