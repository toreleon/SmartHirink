import { z } from 'zod';
import { InterviewPhase, SpeakingParty, UserRole } from './types.js';

// ─── Auth ────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.nativeEnum(UserRole).default(UserRole.CANDIDATE),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Candidate Profile ───────────────────────────────────
export const CandidateProfileCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  resumeText: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().min(0).default(0),
});

// ─── Scenario ────────────────────────────────────────────
export const ScenarioCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  position: z.string().min(1),
  level: z.string().min(1),
  domain: z.string().default('Software Engineering'),
  topics: z.array(z.string()).default([]),
  questionCount: z.number().int().min(1).max(30).default(10),
  durationMinutes: z.number().int().min(5).max(120).default(30),
});

// ─── Rubric ──────────────────────────────────────────────
export const RubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  maxScore: z.number().min(1).max(10).default(5),
  weight: z.number().min(0).max(1).default(0.2),
});

export const RubricCreateSchema = z.object({
  scenarioId: z.string().uuid(),
  criteria: z.array(RubricCriterionSchema).min(1),
});

// ─── Interview Session ───────────────────────────────────
export const InterviewSessionCreateSchema = z.object({
  scenarioId: z.string().uuid(),
  rubricId: z.string().uuid(),
  candidateId: z.string().uuid(),
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
  speaking: z.object({ who: z.nativeEnum(SpeakingParty) }),
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
  languageHint: z.string().optional(),
});

export const ClientDataMessageSchema = z.discriminatedUnion('type', [
  ClientEventSchema,
  CandidateMetadataUpdateSchema,
]);

// ─── Model Config ───────────────────────────────────────
export const ModelConfigCreateSchema = z.object({
  name: z.string().min(1).max(100),
  sttProvider: z.string().min(1),
  sttModel: z.string().optional(),
  llmProvider: z.string().min(1),
  llmModel: z.string().min(1),
  ttsProvider: z.string().min(1),
  ttsVoice: z.string().optional(),
  embeddingProvider: z.string().default('openai'),
  embeddingModel: z.string().default('text-embedding-3-small'),
  isDefault: z.boolean().default(false),
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
  recommendation: z.enum(['STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO']),
});

// ─── Password Change ────────────────────────────────────
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─── Profile Update ─────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

// ─── Inferred types ──────────────────────────────────────
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CandidateProfileCreateInput = z.infer<typeof CandidateProfileCreateSchema>;
export type ScenarioCreateInput = z.infer<typeof ScenarioCreateSchema>;
export type RubricCreateInput = z.infer<typeof RubricCreateSchema>;
export type InterviewSessionCreateInput = z.infer<typeof InterviewSessionCreateSchema>;
export type LiveKitTokenRequest = z.infer<typeof LiveKitTokenRequestSchema>;
export type AgentDataMessage = z.infer<typeof AgentDataMessageSchema>;
export type ClientDataMessage = z.infer<typeof ClientDataMessageSchema>;
export type ModelConfigCreateInput = z.infer<typeof ModelConfigCreateSchema>;
export type EvaluationResultInput = z.infer<typeof EvaluationResultSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
