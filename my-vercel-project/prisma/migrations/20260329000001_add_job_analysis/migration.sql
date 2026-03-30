-- Add jobAnalysis field to Application for storing Claude job intel
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "jobAnalysis" JSONB;
