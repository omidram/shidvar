-- Idempotent hotfix for columns introduced after dc48c00.
-- Safe to re-run on every deploy / start.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "isSpecial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "specialNote" TEXT;

ALTER TABLE "ProcurementRequest"
  ADD COLUMN IF NOT EXISTS "loadType" TEXT NOT NULL DEFAULT 'FULL';
