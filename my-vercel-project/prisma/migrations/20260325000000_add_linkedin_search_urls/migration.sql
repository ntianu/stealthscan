-- Add linkedinSearchUrls column to SearchProfile
ALTER TABLE "SearchProfile" ADD COLUMN "linkedinSearchUrls" TEXT[] NOT NULL DEFAULT '{}';
