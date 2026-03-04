import { z } from 'zod';
import {
  InterviewPhase,
  InterviewLevel,
  SpeakerRole,
  Recommendation,
  UserRole,
  AuditAction,
} from './types.js';

// ─── Base Schema ─────────────────────────────────────────
export const BaseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().optional().nullable(),
  version: z.number().int().positive(),
});

export const AuditableSchema = BaseSchema.extend({
  createdById: z.string().uuid(),
  updatedById: z.string().uuid().optional().nullable(),
});

// ─── Auth ────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.nativeEnum(UserRole).default(UserRole.CANDIDATE),
});

export const LoginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const ProfileUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().transform((e) => e?.toLowerCase()),
});

// ─── User Profiles ───────────────────────────────────────
export const CandidateProfileCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().transform((e) => e.toLowerCase()),
  phone: z.string().optional().nullable(),
  resumeUrl: z.string().url().optional().nullable(),
  resumeText: z.string().optional().nullable(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().min(0).default(0),
  headline: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  githubUrl: z.string().url().optional().nullable(),
});

export const CandidateProfileUpdateSchema = CandidateProfileCreateSchema.partial();

export const RecruiterProfileCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().transform((e) => e.toLowerCase()),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  companyInfo: z.record(z.unknown()).optional().nullable(),
  preferences: z.record(z.unknown()).optional().nullable(),
});

export const RecruiterProfileUpdateSchema = RecruiterProfileCreateSchema.partial();

// ─── Interview Configuration ─────────────────────────────
export const ScenarioCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  position: z.string().min(1),
  level: z.nativeEnum(InterviewLevel),
  domain: z.string().default('Software Engineering'),
  topics: z.array(z.string()).default([]),
  questionCount: z.number().int().min(1).max(30).default(10),
  durationMinutes: z.number().int().min(5).max(120).default(30),
  isPublished: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
});

export const ScenarioUpdateSchema = ScenarioCreateSchema.partial();

export const RubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  maxScore: z.number().int().min(1).max(10).default(5),
  weight: z.number().min(0).max(1).default(0.2),
  order: z.number().int().min(0).default(0),
});

export const RubricCreateSchema = z.object({
  scenarioId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  criteria: z.array(RubricCriterionSchema).min(1),
});

export const RubricUpdateSchema = RubricCreateSchema.partial();

// ─── Interview Session ───────────────────────────────────
export const PhaseTransitionSchema = z.object({
  phase: z.nativeEnum(InterviewPhase),
  timestamp: z.coerce.date(),
});

export const InterviewSessionCreateSchema = z.object({
  scenarioId: z.string().uuid(),
  rubricId: z.string().uuid(),
  candidateId: z.string().uuid(),
  scheduledAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const InterviewSessionUpdateSchema = z.object({
  phase: z.nativeEnum(InterviewPhase).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const InterviewSessionSchema = BaseSchema.extend({
  scenarioId: z.string().uuid(),
  rubricId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  livekitRoom: z.string().min(1),
  phase: z.nativeEnum(InterviewPhase),
  phaseHistory: z.array(PhaseTransitionSchema).default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  endedAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// ─── Turn ────────────────────────────────────────────────
export const TurnCreateSchema = z.object({
  sessionId: z.string().uuid(),
  index: z.number().int().min(0),
  speakerRole: z.nativeEnum(SpeakerRole),
  transcript: z.string().min(1),
  audioUrl: z.string().url().optional().nullable(),
  sttLatencyMs: z.number().int().min(0).optional().nullable(),
  llmTtftMs: z.number().int().min(0).optional().nullable(),
  ttsFirstAudioMs: z.number().int().min(0).optional().nullable(),
  e2eLatencyMs: z.number().int().min(0).optional().nullable(),
  tokensUsed: z.number().int().min(0).optional().nullable(),
});

export const TurnSchema = BaseSchema.extend({
  sessionId: z.string().uuid(),
  index: z.number().int().min(0),
  speakerRole: z.nativeEnum(SpeakerRole),
  transcript: z.string(),
  audioUrl: z.string().url().optional().nullable(),
  sttLatencyMs: z.number().int().min(0).optional().nullable(),
  llmTtftMs: z.number().int().min(0).optional().nullable(),
  ttsFirstAudioMs: z.number().int().min(0).optional().nullable(),
  e2eLatencyMs: z.number().int().min(0).optional().nullable(),
  tokensUsed: z.number().int().min(0).optional().nullable(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional().nullable(),
});

// ─── Evaluation & Scoring ────────────────────────────────
export const ScoreCardCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  weight: z.number().min(0).max(1).default(0.2),
  evidence: z.string().min(1),
  reasoning: z.string().min(1),
  order: z.number().int().min(0).default(0),
});

export const ScoreCardCreateSchema = z.object({
  sessionId: z.string().uuid(),
  overallScore: z.number().min(0),
  maxPossibleScore: z.number().min(1),
  normalizedScore: z.number().min(0).max(100),
  recommendation: z.nativeEnum(Recommendation),
  evaluatedBy: z.string().optional().nullable(),
  criteria: z.array(ScoreCardCriterionSchema).min(1),
});

export const ScoreCardSchema = BaseSchema.extend({
  sessionId: z.string().uuid(),
  overallScore: z.number().min(0),
  maxPossibleScore: z.number().min(1),
  normalizedScore: z.number().min(0).max(100),
  recommendation: z.nativeEnum(Recommendation),
  evaluatedBy: z.string().optional().nullable(),
  evaluatedAt: z.coerce.date(),
});

export const ScoreCardCriterionFullSchema = BaseSchema.extend({
  scoreCardId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  weight: z.number().min(0).max(1),
  evidence: z.string(),
  reasoning: z.string(),
  order: z.number().int().min(0),
});

// ─── Report ──────────────────────────────────────────────
export const ReportCreateSchema = z.object({
  sessionId: z.string().uuid(),
  scoreCardId: z.string().uuid(),
  pdfUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const ReportSchema = BaseSchema.extend({
  sessionId: z.string().uuid(),
  scoreCardId: z.string().uuid(),
  pdfUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  generatedAt: z.coerce.date(),
});

// ─── Model Configuration ─────────────────────────────────
export const ModelConfigCreateSchema = z.object({
  name: z.string().min(1).max(100),
  sttProvider: z.string().min(1),
  sttModel: z.string().optional().nullable(),
  llmProvider: z.string().min(1),
  llmModel: z.string().min(1),
  ttsProvider: z.string().min(1),
  ttsVoice: z.string().optional().nullable(),
  embeddingProvider: z.string().default('openai'),
  embeddingModel: z.string().default('text-embedding-3-small'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).optional().nullable(),
});

export const ModelConfigUpdateSchema = ModelConfigCreateSchema.partial();

export const ModelConfigSchema = BaseSchema.extend({
  name: z.string().min(1).max(100),
  sttProvider: z.string().min(1),
  sttModel: z.string().optional().nullable(),
  llmProvider: z.string().min(1),
  llmModel: z.string().min(1),
  ttsProvider: z.string().min(1),
  ttsVoice: z.string().optional().nullable(),
  embeddingProvider: z.string(),
  embeddingModel: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  config: z.record(z.unknown()).optional().nullable(),
});

// ─── LiveKit Token Request ───────────────────────────────
export const LiveKitTokenRequestSchema = z.object({
  sessionId: z.string().uuid(),
  identity: z.string().min(1),
  role: z.enum(['candidate', 'agent', 'recruiter']),
});

// ─── Data Channel Messages ────────────────────────────────
const BaseTimestamp = z.object({ t: z.number() });

export const PartialTranscriptSchema = BaseTimestamp.extend({
  type: z.literal('partial_transcript'),
  turnId: z.string(),
  text: z.string(),
  isFinal: z.literal(false),
});

export const FinalTranscriptSchema = BaseTimestamp.extend({
  type: z.literal('final_transcript'),
  turnId: z.string(),
  text: z.string(),
  isFinal: z.literal(true),
});

export const AiTextSchema = BaseTimestamp.extend({
  type: z.literal('ai_text'),
  turnId: z.string(),
  text: z.string(),
});

export const StateSchema = BaseTimestamp.extend({
  type: z.literal('state'),
  phase: z.nativeEnum(InterviewPhase),
  speaking: z.object({ who: z.nativeEnum(SpeakerRole) }),
  vad: z.boolean(),
});

export const ErrorSchema = BaseTimestamp.extend({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
});

export const SessionCompleteSchema = BaseTimestamp.extend({
  type: z.literal('session_complete'),
  sessionId: z.string(),
});

export const AgentDataMessageSchema = z.discriminatedUnion('type', [
  PartialTranscriptSchema,
  FinalTranscriptSchema,
  AiTextSchema,
  StateSchema,
  ErrorSchema,
  SessionCompleteSchema,
]);

// ─── Client → Agent ─────────────────────────────────────
export const ClientEventSchema = BaseTimestamp.extend({
  type: z.literal('client_event'),
  action: z.enum(['start', 'pause', 'stop', 'ping']),
});

export const CandidateMetadataUpdateSchema = BaseTimestamp.extend({
  type: z.literal('candidate_metadata_update'),
  languageHint: z.string().optional().nullable(),
});

export const ClientDataMessageSchema = z.discriminatedUnion('type', [
  ClientEventSchema,
  CandidateMetadataUpdateSchema,
]);

// ─── Audit Log ───────────────────────────────────────────
export const AuditLogSchema = BaseSchema.extend({
  userId: z.string().uuid().optional().nullable(),
  action: z.nativeEnum(AuditAction),
  entity: z.string(),
  entityId: z.string().uuid().optional().nullable(),
  oldData: z.record(z.unknown()).optional().nullable(),
  newData: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
});

export const AuditLogCreateSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  action: z.nativeEnum(AuditAction),
  entity: z.string(),
  entityId: z.string().uuid().optional().nullable(),
  oldData: z.record(z.unknown()).optional().nullable(),
  newData: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
});

// ─── Evaluation Result (worker validation) ──────────────
export const CriterionScoreSchema = z.object({
  criterionName: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  evidence: z.string(),
  reasoning: z.string(),
});

export const EvaluationResultSchema = z.object({
  criterionScores: z.array(CriterionScoreSchema).min(1),
  overallScore: z.number().min(0),
  maxPossibleScore: z.number().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendation: z.nativeEnum(Recommendation),
});

// ─── Inferred types ──────────────────────────────────────
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export type CandidateProfileCreateInput = z.infer<typeof CandidateProfileCreateSchema>;
export type CandidateProfileUpdateInput = z.infer<typeof CandidateProfileUpdateSchema>;
export type RecruiterProfileCreateInput = z.infer<typeof RecruiterProfileCreateSchema>;
export type RecruiterProfileUpdateInput = z.infer<typeof RecruiterProfileUpdateSchema>;

export type ScenarioCreateInput = z.infer<typeof ScenarioCreateSchema>;
export type ScenarioUpdateInput = z.infer<typeof ScenarioUpdateSchema>;
export type RubricCreateInput = z.infer<typeof RubricCreateSchema>;
export type RubricUpdateInput = z.infer<typeof RubricUpdateSchema>;

export type InterviewSessionCreateInput = z.infer<typeof InterviewSessionCreateSchema>;
export type InterviewSessionUpdateInput = z.infer<typeof InterviewSessionUpdateSchema>;
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export type TurnCreateInput = z.infer<typeof TurnCreateSchema>;
export type Turn = z.infer<typeof TurnSchema>;

export type ScoreCardCreateInput = z.infer<typeof ScoreCardCreateSchema>;
export type ScoreCard = z.infer<typeof ScoreCardSchema>;
export type ScoreCardCriterion = z.infer<typeof ScoreCardCriterionSchema>;
export type ScoreCardCriterionFull = z.infer<typeof ScoreCardCriterionFullSchema>;

export type ReportCreateInput = z.infer<typeof ReportCreateSchema>;
export type Report = z.infer<typeof ReportSchema>;

export type ModelConfigCreateInput = z.infer<typeof ModelConfigCreateSchema>;
export type ModelConfigUpdateInput = z.infer<typeof ModelConfigUpdateSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export type LiveKitTokenRequest = z.infer<typeof LiveKitTokenRequestSchema>;
export type AgentDataMessage = z.infer<typeof AgentDataMessageSchema>;
export type ClientDataMessage = z.infer<typeof ClientDataMessageSchema>;

export type AuditLog = z.infer<typeof AuditLogSchema>;
export type AuditLogCreateInput = z.infer<typeof AuditLogCreateSchema>;

export type EvaluationResultInput = z.infer<typeof EvaluationResultSchema>;
