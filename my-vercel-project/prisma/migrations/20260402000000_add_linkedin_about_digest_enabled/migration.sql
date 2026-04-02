-- Add linkedinAbout: nullable long-text field for pasting LinkedIn bio
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "linkedinAbout" TEXT;

-- Add digestEnabled: boolean, default true (opt-out of daily digest emails)
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "digestEnabled" BOOLEAN NOT NULL DEFAULT true;
