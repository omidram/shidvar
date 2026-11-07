import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

function emptyDir(dir) {
  if (!existsSync(dir)) return 0;
  const names = readdirSync(dir);
  for (const name of names) {
    rmSync(path.join(dir, name), { recursive: true, force: true });
  }
  return names.length;
}

loadEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const sql = `
DO $$
DECLARE
  admin_ids uuid[];
  keep_company_ids uuid[];
BEGIN
  SELECT array_agg(u.id) INTO admin_ids
  FROM "User" u
  JOIN "UserRole" ur ON ur."userId" = u.id
  JOIN "Role" r ON r.id = ur."roleId"
  WHERE r.code = 'SUPER_ADMIN' AND u."deletedAt" IS NULL;

  IF admin_ids IS NULL OR cardinality(admin_ids) = 0 THEN
    RAISE EXCEPTION 'No SUPER_ADMIN user found. Blank slate aborted.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE id = ANY(admin_ids) AND email IN ('shidroadmin', 'admin@shidvar.local')
  ) THEN
    SELECT array_agg(id) INTO admin_ids
    FROM "User"
    WHERE id = ANY(admin_ids) AND email IN ('shidroadmin', 'admin@shidvar.local');
  END IF;

  SELECT array_agg(DISTINCT m."companyId") INTO keep_company_ids
  FROM "Membership" m
  WHERE m."userId" = ANY(admin_ids);

  IF keep_company_ids IS NULL THEN
    SELECT array_agg(id) INTO keep_company_ids FROM "Company" WHERE type = 'PLATFORM';
  END IF;
  IF keep_company_ids IS NULL THEN
    RAISE EXCEPTION 'Admin has no company. Blank slate aborted.';
  END IF;

  DELETE FROM "TrackingPing";
  DELETE FROM "TrackingSession";
  DELETE FROM "ProofOfDelivery";
  DELETE FROM "ShipmentItem";
  DELETE FROM "Shipment";
  DELETE FROM "DriverApplication";
  DELETE FROM "DriverMatch";
  DELETE FROM "InvoiceLine";
  DELETE FROM "Payment";
  DELETE FROM "CommissionEntry";
  DELETE FROM "Settlement";
  DELETE FROM "LedgerTransaction";
  DELETE FROM "Invoice";
  DELETE FROM "DisputeMessage";
  DELETE FROM "Dispute";
  DELETE FROM "Rating";
  DELETE FROM "TicketMessage";
  DELETE FROM "SupportTicket";
  DELETE FROM "Message";
  DELETE FROM "ConversationParticipant";
  DELETE FROM "Conversation";
  DELETE FROM "Notification";
  DELETE FROM "NotificationPreference";
  DELETE FROM "Document";
  DELETE FROM "CoinTransaction";
  DELETE FROM "CoinWallet";
  DELETE FROM "WalletTransaction";
  DELETE FROM "DriverBankAccount";
  DELETE FROM "WalletAccount";
  DELETE FROM "DriverWallet";
  DELETE FROM "IdempotencyRecord";
  DELETE FROM "Impersonation";
  DELETE FROM "ProfileInfoRequest";
  DELETE FROM "Cancellation";
  DELETE FROM "StatusHistory";
  DELETE FROM "AuditLog";
  DELETE FROM "OrderItem";
  DELETE FROM "TransportationJob";
  DELETE FROM "Order";
  DELETE FROM "SupplierOfferItem";
  DELETE FROM "SupplierOffer";
  DELETE FROM "SupplierMatch";
  DELETE FROM "RequestRequirement";
  DELETE FROM "ProcurementRequestItem";
  DELETE FROM "ProcurementRequest";
  DELETE FROM "DriverVehicle";
  DELETE FROM "Vehicle";
  DELETE FROM "DriverProfile";
  DELETE FROM "CarrierProfile";
  DELETE FROM "SupplierCertification";
  DELETE FROM "SupplierCapacity";
  DELETE FROM "SupplierProduct";
  DELETE FROM "SupplierProfile";
  DELETE FROM "PriceBookLine";
  DELETE FROM "PriceBook";
  DELETE FROM "OperatingArea";
  DELETE FROM "Warehouse";
  DELETE FROM "Store";
  DELETE FROM "Address";
  DELETE FROM "Product";
  UPDATE "ProductCategory" SET "parentId" = NULL;
  DELETE FROM "ProductCategory";
  DELETE FROM "NumberSequence";
  DELETE FROM "CommissionRule";

  UPDATE "Company" SET "verifiedById" = NULL WHERE "verifiedById" IS NOT NULL AND NOT ("verifiedById" = ANY(admin_ids));
  UPDATE "Role" SET "companyId" = NULL WHERE "companyId" IS NOT NULL AND NOT ("companyId" = ANY(keep_company_ids));

  DELETE FROM "UserRole" WHERE NOT ("userId" = ANY(admin_ids));
  DELETE FROM "Membership" WHERE NOT ("userId" = ANY(admin_ids));
  DELETE FROM "Session";
  DELETE FROM "RefreshToken";
  DELETE FROM "CredentialChallenge";
  DELETE FROM "Company" WHERE NOT (id = ANY(keep_company_ids));
  DELETE FROM "User" WHERE NOT (id = ANY(admin_ids));

  INSERT INTO "SystemSetting" ("key", "value")
  VALUES ('blank.applied', '{"ok":true}'::jsonb)
  ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
END $$;
`;

try {
  const force = process.env.SHIDVAR_BLANK_FORCE === "1";
  if (!force) {
    const marker = await prisma.systemSetting.findUnique({ where: { key: "blank.applied" } });
    if (marker) {
      console.log("Blank slate already applied. Skipping.");
      process.exit(0);
    }
  }
  const before = await prisma.user.count();
  await prisma.$executeRawUnsafe(sql);
  const admins = await prisma.user.findMany({
    select: { email: true, firstName: true, lastName: true },
  });
  const storageDir = path.resolve(root, process.env.STORAGE_LOCAL_PATH || "./storage/private");
  const removedFiles = emptyDir(storageDir);
  const users = await prisma.user.count();
  const companies = await prisma.company.count();
  const logs = await prisma.auditLog.count();
  const docs = await prisma.document.count();
  console.log(
    JSON.stringify(
      {
        usersBefore: before,
        usersLeft: users,
        admins,
        companiesLeft: companies,
        auditLogsLeft: logs,
        documentsLeft: docs,
        uploadFoldersCleared: removedFiles,
        storageDir,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
