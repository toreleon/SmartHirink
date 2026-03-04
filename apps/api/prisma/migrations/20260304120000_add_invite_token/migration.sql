-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN "invite_token" TEXT;
ALTER TABLE "interview_sessions" ADD COLUMN "invite_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_invite_token_key" ON "interview_sessions"("invite_token");
