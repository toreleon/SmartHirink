# Entity Base Rules Redesign

## Executive Summary

This document proposes a redesigned entity architecture for SmartHirink's core domain entities: **User**, **Candidate**, **Recruiter**, **Interview**, **Scenario**, and **Rubric**. The redesign focuses on:

1. **Unified User Model** with role-specific profiles
2. **Clear aggregate boundaries** following DDD principles
3. **Immutable domain events** for audit and async workflows
4. **Shared base rules** for common attributes (timestamps, IDs, soft-delete)
5. **Explicit relationships** with cascade rules

---

## Current Issues Identified

### 1. User/Role Model Ambiguity
- `User` table mixes authentication concerns with role-specific data
- `CandidateProfile` duplicates `fullName` and `email` from `User`
- `RECRUITER` role has no profile table (uses `User` directly)
- RBAC checks require joins across tables

### 2. Interview Session Coupling
- `InterviewSession` directly references `candidateId` (CandidateProfile) and `recruiterId` (User)
- No clear aggregate root — is it the session, scenario, or rubric?
- Phase transitions not enforced at schema level

### 3. Missing Domain Invariants
- No soft-delete support (audit trail breaks on deletion)
- No versioning for Scenario/Rubric (can't track changes)
- No explicit constraint on `InterviewPhase` transitions
- `Turn.speakerRole` uses string instead of enum

### 4. Schema Inconsistencies
- `types.ts` interfaces don't match Prisma schema exactly
- Zod schemas in `schemas.ts` are fragmented (no base schema)
- Timestamps handled differently across entities

---

## Proposed Entity Model

### 1. Base Entity Rules (Shared Across All Entities)

```typescript
// packages/core/src/entities/base.ts

export interface BaseEntity {
  id: string;           // UUID v7 (time-sortable)
  createdAt: Date;      // Immutable creation timestamp
  updatedAt: Date;      // Auto-updated on each change
  deletedAt?: Date;     // Soft-delete marker (null = active)
  version: number;      // Optimistic locking version
}

export interface AuditableEntity extends BaseEntity {
  createdById: string;  // User who created
  updatedById?: string; // User who last modified
}
```

**Database Implementation:**
```prisma
// Mixin for all entities
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Base mixin (conceptual — Prisma doesn't support mixins natively)
// Each entity includes these fields:
model Example {
  id        String   @id @default(uuidv7())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?              // Soft delete
  version   Int      @default(1)   // Optimistic lock
}
```

---

### 2. User & Role Aggregates

#### Problem
Current model forces `CANDIDATE` users to have duplicate data in `User` and `CandidateProfile`.

#### Solution: Role-Specific Profile Tables

```prisma
// ─── Users & Authentication ──────────────────────────────
enum UserRole {
  ADMIN
  RECRUITER
  CANDIDATE
}

model User {
  id            String    @id @default(uuidv7())
  email         String    @unique @lowercase
  passwordHash  String    @map("password_hash")
  role          UserRole
  isActive      Boolean   @default(true)  // Suspension support
  lastLoginAt   DateTime? @map("last_login_at")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  // One-to-one profile relations (polymorphic by role)
  candidateProfile CandidateProfile?
  recruiterProfile RecruiterProfile?
  
  // Audit trails
  createdScenarios   Scenario[]         @relation("ScenarioCreator")
  recruitedSessions  InterviewSession[] @relation("Recruiter")
  updatedScenarios   Scenario[]         @relation("ScenarioUpdater")
  
  @@map("users")
  @@index([role, isActive])
}

model CandidateProfile {
  id              String   @id @default(uuidv7())
  userId          String   @unique @map("user_id")
  fullName        String   @map("full_name")
  email           String   // Denormalized for quick access (same as User.email)
  phone           String?
  resumeUrl       String?  @map("resume_url")
  resumeText      String?  @map("resume_text") @db.Text
  skills          String[] @default([])
  experienceYears Int      @default(0) @map("experience_years")
  headline        String?  // New: "Senior Backend Engineer at X"
  location        String?  // New: timezone/city
  linkedinUrl     String?  @map("linkedin_url")
  githubUrl       String?  @map("github_url")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions InterviewSession[]
  
  @@map("candidate_profiles")
  @@index([email])
}

model RecruiterProfile {
  id            String   @id @default(uuidv7())
  userId        String   @unique @map("user_id")
  fullName      String   @map("full_name")
  email         String   // Denormalized
  title         String?  // New: "Senior Technical Recruiter"
  department    String?  // New: "Engineering Hiring"
  phone         String?
  companyInfo   Json?    @map("company_info") // { name, logo, website }
  preferences   Json?    @default({})         // { timezone, notifications }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  user      User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions  InterviewSession[] @relation("RecruiterProfile")
  
  @@map("recruiter_profiles")
}
```

**Key Changes:**
- `RecruiterProfile` created (was missing)
- `User.role` determines which profile table to join
- Profile tables denormalize `email` for query performance
- Added `isActive` to `User` for account suspension without deletion
- Added `location`, `headline`, social links to `CandidateProfile`

---

### 3. Interview Aggregate

#### Problem
`InterviewSession` is an anemic entity with no enforced state transitions.

#### Solution: Interview as Aggregate Root with State Machine

```prisma
// ─── Interview Aggregate ─────────────────────────────────
enum InterviewPhase {
  CREATED     // Session created, waiting for candidate
  SCHEDULED   // New: interview scheduled for future time
  WAITING     // Room active, waiting for candidate to join
  IN_PROGRESS // Candidate joined, interview active
  COMPLETED   // Successfully completed
  CANCELLED   // Cancelled by recruiter/candidate
  NO_SHOW     // New: candidate never joined
}

model InterviewSession {
  id              String        @id @default(uuidv7())
  scenarioId      String        @map("scenario_id")
  rubricId        String        @map("rubric_id")
  candidateId     String        @map("candidate_id") // FK to CandidateProfile.id
  recruiterId     String        @map("recruiter_id") // FK to User.id (not profile)
  livekitRoom     String        @unique @map("livekit_room")
  phase           InterviewPhase @default(CREATED)
  phaseHistory    Json          @default([]) @map("phase_history") // [{phase, timestamp}]
  scheduledAt     DateTime?     @map("scheduled_at") // New: scheduled time
  startedAt       DateTime?     @map("started_at")
  endedAt         DateTime?     @map("ended_at")
  completedAt     DateTime?     @map("completed_at") // New: explicit completion timestamp
  metadata        Json?         @default({}) // { language, timezone, notes }
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  scenario  Scenario         @relation(fields: [scenarioId], references: [id])
  rubric    Rubric           @relation(fields: [rubricId], references: [id])
  candidate CandidateProfile @relation(fields: [candidateId], references: [id])
  recruiter User             @relation("Recruiter", fields: [recruiterId], references: [id])
  
  turns     Turn[]
  scoreCard ScoreCard?
  report    Report?
  
  @@map("interview_sessions")
  @@index([candidateId, phase])
  @@index([recruiterId, phase])
  @@index([scheduledAt])
  @@index([phase, createdAt])
}

model Turn {
  id              String   @id @default(uuidv7())
  sessionId       String   @map("session_id")
  index           Int      // Sequential turn number (enforced unique per session)
  speakerRole     SpeakerRole @map("speaker_role")
  transcript      String   @db.Text
  audioUrl        String?  @map("audio_url")
  sttLatencyMs    Int?     @map("stt_latency_ms")
  llmTtftMs       Int?     @map("llm_ttft_ms") // Time to first token
  ttsFirstAudioMs Int?     @map("tts_first_audio_ms")
  e2eLatencyMs    Int?     @map("e2e_latency_ms")
  tokensUsed      Int?     @map("tokens_used") // New: LLM token count
  startedAt       DateTime @map("started_at")
  endedAt         DateTime? @map("ended_at")

  session InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@unique([sessionId, index])
  @@map("turns")
  @@index([sessionId, index])
}

enum SpeakerRole {
  AI
  CANDIDATE
}
```

**Key Changes:**
- `InterviewPhase` expanded: `SCHEDULED`, `IN_PROGRESS`, `NO_SHOW`
- `phaseHistory` JSON field tracks state transitions for audit
- `scheduledAt` for future interviews
- `metadata` for extensible session config
- `Turn.speakerRole` now uses enum (not string)
- `tokensUsed` for cost tracking

**State Machine (TypeScript):**
```typescript
// packages/core/src/entities/interview.ts

export const PHASE_TRANSITIONS: Record<InterviewPhase, InterviewPhase[]> = {
  CREATED:     ['SCHEDULED', 'WAITING', 'CANCELLED'],
  SCHEDULED:   ['WAITING', 'CANCELLED'],
  WAITING:     ['IN_PROGRESS', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [], // Terminal state
  CANCELLED:   [], // Terminal state
  NO_SHOW:     [], // Terminal state
};

export function canTransition(from: InterviewPhase, to: InterviewPhase): boolean {
  return PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

### 4. Scenario & Rubric Aggregates

#### Problem
No versioning — changes to scenarios/rubrics break historical interview consistency.

#### Solution: Versioned Aggregates with Immutable Snapshots

```prisma
// ─── Interview Configuration ─────────────────────────────
model Scenario {
  id              String   @id @default(uuidv7())
  version         Int      @default(1)
  title           String
  description     String   @db.Text
  position        String   @map("position")
  level           InterviewLevel @map("level")
  domain          String   @default("Software Engineering")
  topics          String[] @default([])
  questionCount   Int      @default(10) @map("question_count")
  durationMinutes Int      @default(30) @map("duration_minutes")
  isPublished     Boolean  @default(false) @map("is_published")
  isTemplate      Boolean  @default(false) @map("is_template") // New: shareable template
  createdById     String   @map("created_by_id")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  createdBy User @relation("ScenarioCreator", fields: [createdById], references: [id])
  rubrics  Rubric[]
  sessions InterviewSession[]
  
  @@map("scenarios")
  @@index([domain, level, isPublished])
  @@unique([id, version]) // Versioned unique
}

enum InterviewLevel {
  INTERN
  JUNIOR
  MID
  SENIOR
  STAFF
  PRINCIPAL
}

model Rubric {
  id          String   @id @default(uuidv7())
  version     Int      @default(1)
  scenarioId  String   @map("scenario_id")
  title       String   // New: explicit title
  description String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  scenario Scenario          @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  criteria RubricCriterion[]
  sessions InterviewSession[]
  
  @@map("rubrics")
  @@index([scenarioId])
  @@unique([id, version])
}

model RubricCriterion {
  id          String   @id @default(uuidv7())
  rubricId    String   @map("rubric_id")
  name        String
  description String   @db.Text
  maxScore    Int      @default(5) @map("max_score")
  weight      Float    @default(0.2)
  order       Int      @default(0) // New: explicit ordering
  
  rubric Rubric @relation(fields: [rubricId], references: [id], onDelete: Cascade)
  
  @@map("rubric_criteria")
  @@index([rubricId, order])
}
```

**Key Changes:**
- `version` field on `Scenario` and `Rubric`
- `isPublished` flag — drafts can be edited, published are immutable
- `isTemplate` for shareable scenario templates
- `InterviewLevel` enum (was string)
- `Rubric.title` for human-readable identification
- `RubricCriterion.order` for explicit ordering

**Versioning Strategy:**
```typescript
// When publishing a scenario:
// 1. Clone current scenario with version + 1
// 2. Clone associated rubric with version + 1
// 3. Mark old version as unpublished (or keep for history)
// 4. New interviews reference the new version

export interface ScenarioVersion {
  id: string;        // Same base ID across versions
  version: number;   // Incrementing version
  // ... other fields
}
```

---

### 5. Evaluation Aggregate

#### Problem
`ScoreCard` and `Report` are separate but tightly coupled. Evaluation data stored as opaque JSON.

#### Solution: Normalized Evaluation with Typed Criteria

```prisma
// ─── Evaluation & Scoring ────────────────────────────────
model ScoreCard {
  id               String   @id @default(uuidv7())
  sessionId        String   @unique @map("session_id")
  overallScore     Float    @map("overall_score")
  maxPossibleScore Float    @map("max_possible_score")
  normalizedScore  Float    @map("normalized_score") // 0-100 percentage
  recommendation   Recommendation @map("recommendation")
  evaluatedBy      String?  @map("evaluated_by") // AI model name or user ID
  evaluatedAt      DateTime @map("evaluated_at")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  session   InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  criteria  ScoreCardCriterion[]
  report    Report?
  
  @@map("score_cards")
}

model ScoreCardCriterion {
  id          String   @id @default(uuidv7())
  scoreCardId String   @map("score_card_id")
  name        String   // e.g. "Technical Depth"
  description String   @db.Text
  score       Int
  maxScore    Int      @map("max_score")
  weight      Float    @default(0.2)
  evidence    String   @db.Text // Transcript quote
  reasoning   String   @db.Text
  order       Int      @default(0)
  
  scoreCard ScoreCard @relation(fields: [scoreCardId], references: [id], onDelete: Cascade)
  
  @@map("score_card_criteria")
  @@index([scoreCardId])
}

enum Recommendation {
  STRONG_NO
  NO
  MAYBE
  YES
  STRONG_YES
}

model Report {
  id          String   @id @default(uuidv7())
  sessionId   String   @unique @map("session_id")
  scoreCardId String   @unique @map("score_card_id")
  pdfUrl      String?  @map("pdf_url")
  summary     String?  @db.Text // AI-generated executive summary
  metadata    Json?    // { generatorVersion, modelUsed }
  generatedAt DateTime @map("generated_at")
  createdAt   DateTime @default(now())
  deletedAt   DateTime?

  session   InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  scoreCard ScoreCard        @relation(fields: [scoreCardId], references: [id], onDelete: Cascade)
  
  @@map("reports")
}
```

**Key Changes:**
- `ScoreCardCriterion` normalized (was JSON array)
- `normalizedScore` for easy comparison
- `evaluatedBy` tracks AI model or human evaluator
- `Report.summary` for quick preview without PDF
- `metadata` for generator tracking

---

### 6. Supporting Entities

```prisma
// ─── Model Configuration ─────────────────────────────────
model ModelConfig {
  id                String   @id @default(uuidv7())
  name              String   @unique
  sttProvider       String   @map("stt_provider")
  sttModel          String?  @map("stt_model")
  llmProvider       String   @map("llm_provider")
  llmModel          String   @map("llm_model")
  ttsProvider       String   @map("tts_provider")
  ttsVoice          String?  @map("tts_voice")
  embeddingProvider String   @map("embedding_provider")
  embeddingModel    String   @map("embedding_model")
  isDefault         Boolean  @default(false) @map("is_default")
  isActive          Boolean  @default(true) @map("is_active") // Soft enable/disable
  config            Json?    // Provider-specific config
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  @@map("model_configs")
}

// ─── Audit Log ───────────────────────────────────────────
enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  PHASE_CHANGE
  EVALUATION
  REPORT_GENERATED
}

model AuditLog {
  id        String   @id @default(uuidv7())
  userId    String?  @map("user_id")
  action    AuditAction
  entity    String   // e.g. "InterviewSession"
  entityId  String?  @map("entity_id")
  oldData   Json?    @map("old_data") // Before image
  newData   Json?    @map("new_data") // After image
  metadata  Json?
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([entity, entityId])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

---

## Zod Schema Redesign

### Base Schema Pattern

```typescript
// packages/core/src/schemas/base.ts

import { z } from 'zod';

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
```

### Entity Schemas

```typescript
// packages/core/src/schemas/interview.ts

export const InterviewPhaseSchema = z.nativeEnum(InterviewPhase);

export const InterviewSessionSchema = BaseSchema.extend({
  scenarioId: z.string().uuid(),
  rubricId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  livekitRoom: z.string().min(1),
  phase: InterviewPhaseSchema,
  phaseHistory: z.array(z.object({
    phase: InterviewPhaseSchema,
    timestamp: z.coerce.date(),
  })).default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  endedAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const InterviewSessionCreateSchema = InterviewSessionSchema
  .pick({
    scenarioId: true,
    rubricId: true,
    candidateId: true,
    scheduledAt: true,
    metadata: true,
  });

export const InterviewSessionUpdateSchema = InterviewSessionSchema
  .pick({
    phase: true,
    scheduledAt: true,
    metadata: true,
  })
  .partial();
```

---

## Migration Strategy

### Phase 1: Add New Tables & Fields (Non-Breaking)
1. Create `RecruiterProfile` table
2. Add `deletedAt`, `version` to all tables
3. Add `phaseHistory`, `scheduledAt`, `metadata` to `InterviewSession`
4. Add `SpeakerRole` enum, migrate `Turn.speakerRole`

### Phase 2: Data Migration
1. Migrate existing `User.role = 'RECRUITER'` to `RecruiterProfile`
2. Backfill `phaseHistory` from `phase` transitions
3. Normalize `ScoreCard.criterionScores` JSON into `ScoreCardCriterion`

### Phase 3: Application Updates
1. Update repositories to use soft-delete
2. Implement state machine in service layer
3. Add versioning logic for Scenario/Rubric

### Phase 4: Cleanup
1. Remove deprecated fields
2. Add NOT NULL constraints where appropriate
3. Enable strict mode in Prisma

---

## Implementation Checklist

- [ ] Create new Prisma schema with all entities
- [ ] Write migration scripts
- [ ] Update `packages/core/src/types.ts` with new interfaces
- [ ] Update `packages/core/src/schemas.ts` with Zod schemas
- [ ] Implement base repository with soft-delete
- [ ] Implement interview state machine service
- [ ] Update API routes for new entity structure
- [ ] Update agent to use new `InterviewSession` fields
- [ ] Update worker for normalized `ScoreCardCriterion`
- [ ] Add integration tests for state transitions
- [ ] Document API changes

---

## Benefits

1. **Clearer Boundaries**: Each aggregate has explicit responsibilities
2. **Audit Trail**: Soft-delete + phase history + audit log
3. **Extensibility**: JSON `metadata` fields for future needs
4. **Type Safety**: Enums instead of strings, normalized evaluation
5. **Versioning**: Scenario/Rubric versioning for historical accuracy
6. **Performance**: Strategic denormalization (email in profiles)
7. **Compliance**: GDPR-ready with soft-delete and data retention
