-- Add streak freezes to Goal
ALTER TABLE "Goal" ADD COLUMN "streakFreezes" INTEGER NOT NULL DEFAULT 1;

-- Add partial completion flag to CheckIn
ALTER TABLE "CheckIn" ADD COLUMN "isPartial" BOOLEAN NOT NULL DEFAULT false;
