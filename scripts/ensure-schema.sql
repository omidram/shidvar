-- Idempotent hotfix for columns introduced after dc48c00.
-- Safe to re-run on every deploy / start.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "isSpecial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "specialNote" TEXT;

ALTER TABLE "ProcurementRequest"
  ADD COLUMN IF NOT EXISTS "loadType" TEXT NOT NULL DEFAULT 'FULL';

-- One cargo-owner role: former supplier companies use the requester portal.
UPDATE "Company" SET type = 'REQUESTER' WHERE type = 'SUPPLIER';

INSERT INTO "UserRole" (id, "userId", "roleId", "companyId", "createdAt")
SELECT gen_random_uuid(), ur."userId", req.id, ur."companyId", NOW()
FROM "UserRole" ur
JOIN "Role" sup ON sup.id = ur."roleId" AND sup.code = 'SUPPLIER_OWNER'
JOIN "Role" req ON req.id = (
  SELECT id FROM "Role" WHERE code = 'REQUESTER_OWNER' AND "isSystem" = true LIMIT 1
)
WHERE NOT EXISTS (
  SELECT 1 FROM "UserRole" existing
  WHERE existing."userId" = ur."userId"
    AND existing."roleId" = req.id
    AND existing."companyId" IS NOT DISTINCT FROM ur."companyId"
);

-- Drop leftover demo tickets and the bell notifications that still show them.
-- Cutoff is 11:00 Tehran on 2 Nov 2026; tickets opened after that stay across restarts.
DELETE FROM "TicketMessage"
WHERE "ticketId" IN (
  SELECT id FROM "SupportTicket" WHERE "createdAt" < TIMESTAMPTZ '2026-11-02T11:00:00+03:30'
);
DELETE FROM "SupportTicket" WHERE "createdAt" < TIMESTAMPTZ '2026-11-02T11:00:00+03:30';
DELETE FROM "Notification"
WHERE "createdAt" < TIMESTAMPTZ '2026-11-02T11:00:00+03:30'
  AND ("eventType" LIKE 'ticket.%' OR "title" LIKE 'تیکت پشتیبانی%');
