-- CreateEnum
CREATE TYPE "ChallengeMode" AS ENUM ('STANDARD', 'TEAM_VS_TEAM', 'DUO_COMPETITION');

-- AlterTable: Add persistent tier tracking to Group
ALTER TABLE "Group" ADD COLUMN "currentTier" TEXT NOT NULL DEFAULT 'BRONZE',
ADD COLUMN "weeklyCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastTierUpdate" TIMESTAMP(3);

-- AlterTable: Add challenge mode configuration to GroupChallenge
ALTER TABLE "GroupChallenge" ADD COLUMN "mode" "ChallengeMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "teamAssignments" JSONB,
ADD COLUMN "duoAssignments" JSONB;

-- CreateIndex
CREATE INDEX "GroupChallenge_groupId_startDate_idx" ON "GroupChallenge"("groupId", "startDate");
