-- Bullet Library v2 — new enums, BulletVariant table, enriched Bullet fields, selectedBulletIds on Application

-- BulletCategory enum
DO $$ BEGIN
  CREATE TYPE "BulletCategory" AS ENUM (
    'achievement', 'leadership', 'technical', 'cross_functional',
    'growth', 'stakeholder', 'data_driven', 'operational'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VariantSource enum
DO $$ BEGIN
  CREATE TYPE "VariantSource" AS ENUM ('AI_GENERATED', 'USER_EDITED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add enrichment columns to Bullet
ALTER TABLE "Bullet" ADD COLUMN IF NOT EXISTS "category"    "BulletCategory";
ALTER TABLE "Bullet" ADD COLUMN IF NOT EXISTS "context"     TEXT;
ALTER TABLE "Bullet" ADD COLUMN IF NOT EXISTS "useCount"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bullet" ADD COLUMN IF NOT EXISTS "winRate"     DOUBLE PRECISION;
ALTER TABLE "Bullet" ADD COLUMN IF NOT EXISTS "lastUsedAt"  TIMESTAMP(3);

-- Add selectedBulletIds to Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "selectedBulletIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Create BulletVariant table
CREATE TABLE IF NOT EXISTS "BulletVariant" (
  "id"            TEXT NOT NULL,
  "bulletId"      TEXT NOT NULL,
  "roleFamily"    TEXT NOT NULL,
  "content"       TEXT NOT NULL,
  "source"        "VariantSource" NOT NULL DEFAULT 'AI_GENERATED',
  "approved"      BOOLEAN NOT NULL DEFAULT false,
  "applicationId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BulletVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BulletVariant_bulletId_roleFamily_key" UNIQUE ("bulletId", "roleFamily")
);

-- FK: BulletVariant → Bullet (cascade delete)
ALTER TABLE "BulletVariant"
  ADD CONSTRAINT "BulletVariant_bulletId_fkey"
  FOREIGN KEY ("bulletId") REFERENCES "Bullet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Index on bulletId for fast variant lookups
CREATE INDEX IF NOT EXISTS "BulletVariant_bulletId_idx" ON "BulletVariant"("bulletId");
