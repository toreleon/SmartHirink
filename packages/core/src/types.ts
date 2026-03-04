// ─── Base Entity Types ───────────────────────────────────
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  version: number;
}

export interface AuditableEntity extends BaseEntity {
  createdById: string;
  updatedById?: string | null;
}

// ─── Role & Auth ─────────────────────────────────────────
export enum UserRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  CANDIDATE = 'CANDIDATE',
}

export enum InterviewLevel {
  INTERN = 'INTERN',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  STAFF = 'STAFF',
  PRINCIPAL = 'PRINCIPAL',
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── User Profiles ───────────────────────────────────────
export interface User extends BaseEntity {
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  candidateProfile?: CandidateProfile | null;
  recruiterProfile?: RecruiterProfile | null;
}

export interface CandidateProfile extends BaseEntity {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
  skills: string[];
  experienceYears: number;
  headline?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  user?: User;
}

export interface RecruiterProfile extends BaseEntity {
  userId: string;
  fullName: string;
  email: string;
  title?: string | null;
  department?: string | null;
  phone?: string | null;
  companyInfo?: Record<string, unknown> | null;
  preferences?: Record<string, unknown> | null;
  user?: User;
}

// ─── Interview Domain ────────────────────────────────────
export enum InterviewPhase {
  CREATED = 'CREATED',
  SCHEDULED = 'SCHEDULED',
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum SpeakerRole {
  AI = 'AI',
  CANDIDATE = 'CANDIDATE',
}

export enum Recommendation {
  STRONG_NO = 'STRONG_NO',
  NO = 'NO',
  MAYBE = 'MAYBE',
  YES = 'YES',
  STRONG_YES = 'STRONG_YES',
}

export interface PhaseTransition {
  phase: InterviewPhase;
  timestamp: Date;
}

export interface Scenario extends AuditableEntity {
  version: number;
  title: string;
  description: string;
  position: string;
  level: InterviewLevel;
  domain: string;
  topics: string[];
  questionCount: number;
  durationMinutes: number;
  isPublished: boolean;
  isTemplate: boolean;
  createdBy?: User;
  rubrics?: Rubric[];
  sessions?: InterviewSession[];
}

export interface Rubric extends BaseEntity {
  version: number;
  scenarioId: string;
  title: string;
  description?: string | null;
  scenario?: Scenario;
  criteria?: RubricCriterion[];
  sessions?: InterviewSession[];
}

export interface RubricCriterion extends BaseEntity {
  rubricId: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  order: number;
  rubric?: Rubric;
}

export interface InterviewSession extends BaseEntity {
  scenarioId: string;
  rubricId: string;
  candidateId: string;
  recruiterId: string;
  livekitRoom?: string | null;
  phase: InterviewPhase;
  phaseHistory: PhaseTransition[];
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  completedAt?: Date | null;
  metadata: Record<string, unknown> | null;
  scenario?: Scenario;
  rubric?: Rubric;
  candidate?: CandidateProfile;
  recruiter?: User;
  turns?: Turn[];
  scoreCard?: ScoreCard | null;
  report?: Report | null;
}

export interface Turn extends BaseEntity {
  sessionId: string;
  index: number;
  speakerRole: SpeakerRole;
  transcript: string;
  audioUrl?: string | null;
  sttLatencyMs?: number | null;
  llmTtftMs?: number | null;
  ttsFirstAudioMs?: number | null;
  e2eLatencyMs?: number | null;
  tokensUsed?: number | null;
  startedAt: Date;
  endedAt?: Date | null;
  session?: InterviewSession;
}

// ─── Evaluation Domain ───────────────────────────────────
export interface ScoreCard extends BaseEntity {
  sessionId: string;
  overallScore: number;
  maxPossibleScore: number;
  normalizedScore: number;
  recommendation: Recommendation;
  evaluatedBy?: string | null;
  evaluatedAt: Date;
  session?: InterviewSession;
  criteria?: ScoreCardCriterion[];
  report?: Report | null;
}

export interface ScoreCardCriterion extends BaseEntity {
  scoreCardId: string;
  name: string;
  description: string;
  score: number;
  maxScore: number;
  weight: number;
  evidence: string;
  reasoning: string;
  order: number;
  scoreCard?: ScoreCard;
}

export interface Report extends BaseEntity {
  sessionId: string;
  scoreCardId: string;
  pdfUrl?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  generatedAt: Date;
  session?: InterviewSession;
  scoreCard?: ScoreCard;
}

// ─── Model Configuration ─────────────────────────────────
export interface ModelConfig extends BaseEntity {
  name: string;
  sttProvider: string;
  sttModel?: string | null;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  ttsVoice?: string | null;
  embeddingProvider: string;
  embeddingModel: string;
  isDefault: boolean;
  isActive: boolean;
  config?: Record<string, unknown> | null;
}

// ─── Audit Log ───────────────────────────────────────────
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PHASE_CHANGE = 'PHASE_CHANGE',
  EVALUATION = 'EVALUATION',
  REPORT_GENERATED = 'REPORT_GENERATED',
}

export interface AuditLog extends BaseEntity {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ─── Legacy Type Aliases (for backward compatibility) ───
/** @deprecated Use SpeakerRole instead */
export type SpeakingParty = SpeakerRole;
