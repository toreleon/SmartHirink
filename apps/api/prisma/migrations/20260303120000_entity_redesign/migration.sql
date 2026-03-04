-- AlterEnum: Add new InterviewPhase values
ALTER TYPE "InterviewPhase"
ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "InterviewPhase"
ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "InterviewPhase"
ADD VALUE IF NOT EXISTS 'NO_SHOW';

-- AlterEnum: Add new SpeakerRole enum
DO $$ BEGIN
    CREATE TYPE "SpeakerRole" AS ENUM ('AI', 'CANDIDATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add new Recommendation enum
DO $$ BEGIN
    CREATE TYPE "Recommendation" AS ENUM ('STRONG_NO', 'NO', 'MAYBE', 'YES', 'STRONG_YES');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add new InterviewLevel enum
DO $$ BEGIN
    CREATE TYPE "InterviewLevel" AS ENUM ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add new AuditAction enum
DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PHASE_CHANGE', 'EVALUATION', 'REPORT_GENERATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: users - add new columns
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable: candidate_profiles - add new columns
ALTER TABLE "candidate_profiles"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "headline" TEXT,
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT,
ADD COLUMN IF NOT EXISTS "github_url" TEXT;

-- CreateTable: recruiter_profiles
CREATE TABLE IF NOT EXISTS "recruiter_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "company_info" JSONB,
    "preferences" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: recruiter_profiles
CREATE UNIQUE INDEX IF NOT EXISTS "recruiter_profiles_user_id_key" ON "recruiter_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "recruiter_profiles_email_idx" ON "recruiter_profiles"("email");

-- AddForeignKey: recruiter_profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'recruiter_profiles_user_id_fkey'
    ) THEN
        ALTER TABLE "recruiter_profiles" 
        ADD CONSTRAINT "recruiter_profiles_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable: scenarios - add new columns
ALTER TABLE "scenarios"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "level_enum" "InterviewLevel" NOT NULL DEFAULT 'MID',
ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Migrate level string to enum (store in new column, application should migrate)
-- Note: Application code should handle the migration of 'level' string to 'level_enum'

-- AlterTable: rubrics - add new columns
ALTER TABLE "rubrics"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Untitled Rubric',
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable: rubric_criteria - add new columns
ALTER TABLE "rubric_criteria"
ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: interview_sessions - add new columns
ALTER TABLE "interview_sessions"
ADD COLUMN IF NOT EXISTS "phase_history" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable: turns - change speaker_role to use enum
-- First add new column with enum type
ALTER TABLE "turns"
ADD COLUMN IF NOT EXISTS "speaker_role_enum" "SpeakerRole" NOT NULL DEFAULT 'AI';

-- Migrate existing string values to enum
UPDATE "turns" SET "speaker_role_enum" = 'AI' WHERE "speaker_role" = 'AI';
UPDATE "turns" SET "speaker_role_enum" = 'CANDIDATE' WHERE "speaker_role" = 'CANDIDATE';

-- Drop old column and rename new one (if needed in future migration)
-- For now, keep both for backward compatibility

-- Add new tokens_used column
ALTER TABLE "turns"
ADD COLUMN IF NOT EXISTS "tokens_used" INTEGER;

-- AlterTable: score_cards - add new columns
ALTER TABLE "score_cards"
ADD COLUMN IF NOT EXISTS "normalized_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "recommendation_enum" "Recommendation" NOT NULL DEFAULT 'MAYBE',
ADD COLUMN IF NOT EXISTS "evaluated_by" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Migrate recommendation string to enum
UPDATE "score_cards" SET "recommendation_enum" = 
    CASE 
        WHEN "recommendation" = 'STRONG_NO' THEN 'STRONG_NO'::"Recommendation"
        WHEN "recommendation" = 'NO' THEN 'NO'::"Recommendation"
        WHEN "recommendation" = 'MAYBE' THEN 'MAYBE'::"Recommendation"
        WHEN "recommendation" = 'YES' THEN 'YES'::"Recommendation"
        WHEN "recommendation" = 'STRONG_YES' THEN 'STRONG_YES'::"Recommendation"
        ELSE 'MAYBE'::"Recommendation"
    END;

-- CreateTable: score_card_criteria
CREATE TABLE IF NOT EXISTS "score_card_criteria" (
    "id" UUID NOT NULL,
    "score_card_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "evidence" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "score_card_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: score_card_criteria
CREATE INDEX IF NOT EXISTS "score_card_criteria_score_card_id_idx" ON "score_card_criteria"("score_card_id");

-- AddForeignKey: score_card_criteria
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'score_card_criteria_score_card_id_fkey'
    ) THEN
        ALTER TABLE "score_card_criteria" 
        ADD CONSTRAINT "score_card_criteria_score_card_id_fkey" 
        FOREIGN KEY ("score_card_id") REFERENCES "score_cards"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable: reports - add new columns
ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "summary" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable: model_configs - add new columns
ALTER TABLE "model_configs"
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "config" JSONB,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable: audit_logs - change action to use enum
-- First add new column with enum type
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "action_enum" "AuditAction" NOT NULL DEFAULT 'CREATE';

-- Add new columns for audit
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "old_data" JSONB,
ADD COLUMN IF NOT EXISTS "new_data" JSONB,
ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
ADD COLUMN IF NOT EXISTS "user_agent" TEXT;

-- CreateIndex: Add new indexes
CREATE INDEX IF NOT EXISTS "candidate_profiles_email_idx" ON "candidate_profiles"("email");
CREATE INDEX IF NOT EXISTS "scenarios_domain_level_is_published_idx" ON "scenarios"("domain", "level_enum", "is_published");
CREATE INDEX IF NOT EXISTS "rubrics_scenario_id_idx" ON "rubrics"("scenario_id");
CREATE INDEX IF NOT EXISTS "rubric_criteria_rubric_id_order_idx" ON "rubric_criteria"("rubric_id", "order");
CREATE INDEX IF NOT EXISTS "interview_sessions_candidate_id_phase_idx" ON "interview_sessions"("candidate_id", "phase");
CREATE INDEX IF NOT EXISTS "interview_sessions_recruiter_id_phase_idx" ON "interview_sessions"("recruiter_id", "phase");
CREATE INDEX IF NOT EXISTS "interview_sessions_scheduled_at_idx" ON "interview_sessions"("scheduled_at");
CREATE INDEX IF NOT EXISTS "interview_sessions_phase_created_at_idx" ON "interview_sessions"("phase", "created_at");
CREATE INDEX IF NOT EXISTS "turns_session_id_index_idx" ON "turns"("session_id", "index");
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action_enum", "created_at");

-- Add default model config if not exists
INSERT INTO "model_configs" (id, name, stt_provider, llm_provider, llm_model, tts_provider, embedding_provider, embedding_model, is_default, is_active)
SELECT 
    gen_random_uuid(),
    'Default Configuration',
    'deepgram',
    'openai',
    'gpt-4o-mini',
    'openai',
    'openai',
    'text-embedding-3-small',
    true,
    true
WHERE NOT EXISTS (SELECT 1 FROM "model_configs" WHERE is_default = true);
