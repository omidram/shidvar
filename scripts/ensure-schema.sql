-- Idempotent hotfix for columns introduced after dc48c00.
-- Safe to re-run on every deploy / start.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "isSpecial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "specialNote" TEXT;

ALTER TABLE "ProcurementRequest"
  ADD COLUMN IF NOT EXISTS "loadType" TEXT NOT NULL DEFAULT 'FULL';

-- Drop leftover demo tickets from before this release (safe after restart: newer tickets stay).
DELETE FROM "TicketMessage"
WHERE "ticketId" IN (SELECT id FROM "SupportTicket" WHERE "createdAt" < TIMESTAMPTZ '2026-11-02T12:00:00Z');
DELETE FROM "SupportTicket" WHERE "createdAt" < TIMESTAMPTZ '2026-11-02T12:00:00Z';
