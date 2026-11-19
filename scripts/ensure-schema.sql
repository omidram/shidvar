-- Idempotent hotfix for columns introduced after dc48c00.
-- Safe to re-run on every deploy / start.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "isSpecial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "specialNote" TEXT;

ALTER TABLE "ProcurementRequest"
  ADD COLUMN IF NOT EXISTS "loadType" TEXT NOT NULL DEFAULT 'FULL';

ALTER TABLE "ProcurementRequest"
  ADD COLUMN IF NOT EXISTS "settlementMethod" TEXT;

ALTER TABLE "TransportationJob"
  ADD COLUMN IF NOT EXISTS "settlementMethod" TEXT;

CREATE TABLE IF NOT EXISTS "PartnerShipment" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "cargoType" TEXT NOT NULL,
  "cartonCount" INTEGER NOT NULL,
  "cargoAmount" DECIMAL(18,4) NOT NULL,
  "province" TEXT NOT NULL,
  "county" TEXT,
  "city" TEXT NOT NULL,
  "warehouseName" TEXT NOT NULL DEFAULT 'شورآباد',
  "receivedAt" TIMESTAMP(3),
  "promisedDeliveryAt" TIMESTAMP(3),
  "shipAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "driverId" TEXT,
  "driverLocation" TEXT,
  "freightAmount" DECIMAL(18,4),
  "invoiceId" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerShipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerShipment_number_key" ON "PartnerShipment"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerShipment_invoiceId_key" ON "PartnerShipment"("invoiceId");
CREATE INDEX IF NOT EXISTS "PartnerShipment_companyId_status_idx" ON "PartnerShipment"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PartnerShipment_status_idx" ON "PartnerShipment"("status");

ALTER TABLE "PartnerShipment" ADD COLUMN IF NOT EXISTS "promisedDeliveryAt" TIMESTAMP(3);
ALTER TABLE "PartnerShipment" ADD COLUMN IF NOT EXISTS "driverLocation" TEXT;

DO $$ BEGIN
  ALTER TABLE "PartnerShipment" ADD CONSTRAINT "PartnerShipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PartnerShipment" ADD CONSTRAINT "PartnerShipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PartnerShipment" ADD CONSTRAINT "PartnerShipment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PartnerShipment" ADD CONSTRAINT "PartnerShipment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
