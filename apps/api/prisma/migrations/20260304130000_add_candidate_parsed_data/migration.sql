-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN "portfolio_url" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "summary" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "parsed_data" JSONB;
