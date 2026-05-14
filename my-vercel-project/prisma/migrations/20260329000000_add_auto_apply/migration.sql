-- Add auto-apply fields to SearchProfile
ALTER TABLE "SearchProfile" ADD COLUMN IF NOT EXISTS "autoApply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SearchProfile" ADD COLUMN IF NOT EXISTS "autoApplyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75;
