-- Add linkedinSearchUrls column to SearchProfile (IF NOT EXISTS — safe to re-run)
ALTER TABLE "SearchProfile" ADD COLUMN IF NOT EXISTS "linkedinSearchUrls" TEXT[] NOT NULL DEFAULT '{}';
