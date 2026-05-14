-- Stealth Scan v2: Career Context + expanded scoring + decision memory

-- New enums
DO $$ BEGIN
  CREATE TYPE "ConfidenceBand" AS ENUM ('HIGH', 'MEDIUM', 'EXPLORATORY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContextDocumentType" AS ENUM (
    'career_strategy',
    'positioning',
    'experience_library',
    'decision_rules',
    'writing_voice',
    'target_companies',
    'decision_log'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Application: v2 confidence + rationale fields
ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "confidenceBand"    "ConfidenceBand",
  ADD COLUMN IF NOT EXISTS "rationale"         TEXT,
  ADD COLUMN IF NOT EXISTS "risks"             TEXT,
  ADD COLUMN IF NOT EXISTS "decisionReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "savedForLater"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiRecommendation"  TEXT,
  ADD COLUMN IF NOT EXISTS "reviewOpenedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "coverLetterEdited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "editCount"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "industryScore"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "companyScore"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "decisionRuleScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "trajectoryScore"   DOUBLE PRECISION;

-- ContextDocument table
CREATE TABLE IF NOT EXISTS "ContextDocument" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "type"       "ContextDocumentType" NOT NULL,
  "title"      TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "compiled"   TEXT,
  "compiledAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextDocument_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one document per type per user
CREATE UNIQUE INDEX IF NOT EXISTS "ContextDocument_userId_type_key"
  ON "ContextDocument"("userId", "type");

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS "ContextDocument_userId_idx"
  ON "ContextDocument"("userId");

-- Foreign key
ALTER TABLE "ContextDocument"
  DROP CONSTRAINT IF EXISTS "ContextDocument_userId_fkey";
ALTER TABLE "ContextDocument"
  ADD CONSTRAINT "ContextDocument_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
