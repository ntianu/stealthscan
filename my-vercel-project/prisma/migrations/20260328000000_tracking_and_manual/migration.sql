-- Add MANUAL to Source enum
ALTER TYPE "Source" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Add INTERVIEWING and OFFER to ApplicationStatus enum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEWING';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER';

-- Add notes and interviewDate to Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "interviewDate" TIMESTAMP(3);
