import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import { assertPermission, type Actor } from "@/server/rbac/actor";
import { FileService } from "@/server/storage/file-service";

export const PURGE_SECTIONS = ["loads", "invoices", "drivers", "owners", "chats", "notifications", "tickets", "documents", "logs"] as const;

export const purgeSectionSchema = z.object({
  section: z.enum(PURGE_SECTIONS),
  confirm: z.literal(true),
});

export type PurgeSectionId = (typeof PURGE_SECTIONS)[number];

type Db = Prisma.TransactionClient;

const LOAD_DOCS = ["TransportationJob", "ProcurementRequest", "Order", "Shipment"];

function filled(ids: string[]) {
  return ids.length > 0;
}

async function storageKeys(where: Prisma.DocumentWhereInput) {
  const rows = await prisma.document.findMany({ where, select: { storageKey: true } });
  return rows.map((row) => row.storageKey);
}

async function filesFor(section: PurgeSectionId) {
  if (section === "documents") return storageKeys({});
  if (section === "loads" || section === "owners") {
    const docs = await storageKeys({ entityType: { in: LOAD_DOCS } });
    const pods = await prisma.proofOfDelivery.findMany({
      where: { signatureStorageKey: { not: null } },
      select: { signatureStorageKey: true },
    });
    const ownerDocs =
      section === "owners"
        ? await storageKeys({ ownerCompany: { type: { in: ["REQUESTER", "SUPPLIER"] } } })
        : [];
    return [...docs, ...ownerDocs, ...pods.map((row) => row.signatureStorageKey).filter((key): key is string => Boolean(key))];
  }
  if (section === "drivers") {
    const drivers = await prisma.driverProfile.findMany({ select: { userId: true } });
    if (!drivers.length) return [];
    return storageKeys({ uploadedById: { in: drivers.map((row) => row.userId) } });
  }
  return [];
}

async function countSection(section: PurgeSectionId) {
  switch (section) {
    case "loads":
      return prisma.procurementRequest.count();
    case "invoices":
      return prisma.invoice.count();
    case "drivers":
      return prisma.driverProfile.count();
    case "owners":
      return prisma.company.count({ where: { type: { in: ["REQUESTER", "SUPPLIER"] } } });
    case "chats":
      return prisma.conversation.count();
    case "notifications":
      return prisma.notification.count();
    case "tickets":
      return prisma.supportTicket.count();
    case "documents":
      return prisma.document.count();
    case "logs":
      return prisma.auditLog.count();
  }
}

export async function listPurgeSections() {
  const entries = await Promise.all(
    PURGE_SECTIONS.map(async (id) => ({ id, count: await countSection(id) })),
  );
  return entries;
}

async function resetNumbers(db: Db, prefixes: string[]) {
  await db.numberSequence.deleteMany({
    where: { OR: prefixes.map((prefix) => ({ key: { startsWith: `${prefix}-` } })) },
  });
}

async function purgeLoads(db: Db) {
  await db.trackingPing.deleteMany();
  await db.trackingSession.deleteMany();
  await db.proofOfDelivery.deleteMany();
  await db.shipmentItem.deleteMany();
  await db.shipment.deleteMany();
  await db.driverApplication.deleteMany();
  await db.driverMatch.deleteMany();
  await db.disputeMessage.deleteMany();
  await db.dispute.deleteMany();
  await db.rating.deleteMany();
  await db.orderItem.deleteMany();
  await db.transportationJob.deleteMany();
  await db.invoice.updateMany({ where: { orderId: { not: null } }, data: { orderId: null } });
  await db.order.deleteMany();
  await db.supplierOfferItem.deleteMany();
  await db.supplierOffer.deleteMany();
  await db.supplierMatch.deleteMany();
  await db.requestRequirement.deleteMany();
  await db.procurementRequestItem.deleteMany();
  await db.procurementRequest.deleteMany();
  await db.document.deleteMany({ where: { entityType: { in: LOAD_DOCS } } });
  await resetNumbers(db, ["PR", "ORD", "JOB", "SHP", "OF"]);
}

async function purgeInvoices(db: Db) {
  await db.payment.deleteMany();
  await db.commissionEntry.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.settlement.deleteMany();
  await db.ledgerTransaction.deleteMany();
  await db.invoice.deleteMany();
  await resetNumbers(db, ["INV"]);
}

async function detachUsers(db: Db, userIds: string[]) {
  if (!filled(userIds)) return;
  await db.message.deleteMany({ where: { senderId: { in: userIds } } });
  await db.ticketMessage.deleteMany({ where: { authorId: { in: userIds } } });
  await db.supportTicket.updateMany({ where: { assignedToId: { in: userIds } }, data: { assignedToId: null } });
  await db.document.deleteMany({ where: { uploadedById: { in: userIds } } });
  await db.rating.deleteMany({ where: { raterUserId: { in: userIds } } });
  await db.dispute.updateMany({ where: { assigneeId: { in: userIds } }, data: { assigneeId: null } });
  const disputes = await db.dispute.findMany({ where: { reporterId: { in: userIds } }, select: { id: true } });
  if (filled(disputes.map((row) => row.id))) {
    await db.disputeMessage.deleteMany({ where: { disputeId: { in: disputes.map((row) => row.id) } } });
  }
  await db.dispute.deleteMany({ where: { reporterId: { in: userIds } } });
  await db.auditLog.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });
  await db.company.updateMany({ where: { verifiedById: { in: userIds } }, data: { verifiedById: null } });
  await db.impersonation.deleteMany({
    where: { OR: [{ impersonatorId: { in: userIds } }, { targetUserId: { in: userIds } }] },
  });
  await db.idempotencyRecord.deleteMany({ where: { userId: { in: userIds } } });
  const keeper = await db.user.findFirst({
    where: { userRoles: { some: { role: { code: "SUPER_ADMIN" } } }, id: { notIn: userIds } },
    select: { id: true },
  });
  if (keeper) {
    await db.procurementRequest.updateMany({ where: { createdById: { in: userIds } }, data: { createdById: keeper.id } });
  }
}

async function deleteCompanies(db: Db, companyIds: string[]) {
  if (!filled(companyIds)) return;
  const warehouses = await db.warehouse.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  const warehouseIds = warehouses.map((row) => row.id);
  const stores = await db.store.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  const storeIds = stores.map((row) => row.id);
  if (filled(warehouseIds)) {
    await db.transportationJob.updateMany({ where: { pickupWarehouseId: { in: warehouseIds } }, data: { pickupWarehouseId: null } });
    await db.transportationJob.updateMany({ where: { deliveryWarehouseId: { in: warehouseIds } }, data: { deliveryWarehouseId: null } });
    await db.procurementRequest.updateMany({ where: { destinationWarehouseId: { in: warehouseIds } }, data: { destinationWarehouseId: null } });
  }
  if (filled(storeIds)) {
    await db.procurementRequest.updateMany({ where: { storeId: { in: storeIds } }, data: { storeId: null } });
  }
  const invoices = await db.invoice.findMany({
    where: { OR: [{ issuerCompanyId: { in: companyIds } }, { recipientCompanyId: { in: companyIds } }] },
    select: { id: true },
  });
  const invoiceIds = invoices.map((row) => row.id);
  if (filled(invoiceIds)) {
    await db.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await db.commissionEntry.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await db.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await db.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }
  const offers = await db.supplierOffer.findMany({ where: { supplierCompanyId: { in: companyIds } }, select: { id: true } });
  const offerIds = offers.map((row) => row.id);
  if (filled(offerIds)) {
    await db.supplierOfferItem.deleteMany({ where: { offerId: { in: offerIds } } });
    await db.supplierOffer.deleteMany({ where: { id: { in: offerIds } } });
  }
  await db.warehouse.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.store.updateMany({ where: { companyId: { in: companyIds } }, data: { addressId: null } });
  await db.store.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.address.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.priceBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.vehicle.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.supplierMatch.deleteMany({ where: { supplierCompanyId: { in: companyIds } } });
  await db.document.deleteMany({ where: { ownerCompanyId: { in: companyIds } } });
  await db.conversationParticipant.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.operatingArea.deleteMany({ where: { ownerType: "SUPPLIER", ownerId: { in: companyIds } } });
  const roles = await db.role.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  const roleIds = roles.map((row) => row.id);
  await db.userRole.deleteMany({ where: { companyId: { in: companyIds } } });
  if (filled(roleIds)) {
    await db.userRole.deleteMany({ where: { roleId: { in: roleIds } } });
    await db.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  }
  await db.role.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.membership.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.company.updateMany({ where: { id: { in: companyIds } }, data: { verifiedById: null } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function purgeDrivers(db: Db) {
  const drivers = await db.driverProfile.findMany({ select: { id: true, userId: true, carrierCompanyId: true } });
  const userIds = [...new Set(drivers.map((row) => row.userId))];
  const protectedUsers = filled(userIds)
    ? await db.user.findMany({
        where: { id: { in: userIds }, userRoles: { some: { role: { OR: [{ code: "SUPER_ADMIN" }, { portal: "PLATFORM" }] } } } },
        select: { id: true },
      })
    : [];
  const keep = new Set(protectedUsers.map((row) => row.id));
  const removable = userIds.filter((id) => !keep.has(id));
  await db.transportationJob.updateMany({
    where: { OR: [{ assignedDriverId: { not: null } }, { assignedVehicleId: { not: null } }] },
    data: { assignedDriverId: null, assignedVehicleId: null },
  });
  await db.procurementRequest.updateMany({ where: { vipDriverId: { not: null } }, data: { vipDriverId: null } });
  await db.driverApplication.deleteMany();
  await db.driverMatch.deleteMany();
  await db.walletTransaction.deleteMany();
  await db.walletAccount.deleteMany();
  await db.driverBankAccount.deleteMany();
  await db.driverWallet.deleteMany();
  await db.driverVehicle.deleteMany();
  await db.operatingArea.deleteMany({ where: { ownerType: "DRIVER" } });
  await detachUsers(db, removable);
  await db.driverProfile.deleteMany();
  const carriers = [...new Set(drivers.map((row) => row.carrierCompanyId))];
  const stillUsed = new Set((await db.driverProfile.findMany({ select: { carrierCompanyId: true } })).map((row) => row.carrierCompanyId));
  const unusedCarriers = carriers.filter((id) => !stillUsed.has(id));
  const carrierCompanies = filled(unusedCarriers)
    ? await db.company.findMany({ where: { id: { in: unusedCarriers }, type: "CARRIER" }, select: { id: true } })
    : [];
  await deleteCompanies(
    db,
    carrierCompanies.map((row) => row.id),
  );
  if (filled(removable)) await db.user.deleteMany({ where: { id: { in: removable } } });
}

async function purgeOwners(db: Db) {
  const companies = await db.company.findMany({
    where: { type: { in: ["REQUESTER", "SUPPLIER"] } },
    select: { id: true },
  });
  const companyIds = companies.map((row) => row.id);
  await purgeLoads(db);
  await purgeInvoices(db);
  const memberships = filled(companyIds)
    ? await db.membership.findMany({ where: { companyId: { in: companyIds } }, select: { userId: true } })
    : [];
  const candidateIds = [...new Set(memberships.map((row) => row.userId))];
  const protectedUsers = filled(candidateIds)
    ? await db.user.findMany({
        where: {
          id: { in: candidateIds },
          OR: [
            { userRoles: { some: { role: { OR: [{ code: "SUPER_ADMIN" }, { portal: "PLATFORM" }] } } } },
            { driverProfile: { isNot: null } },
            { memberships: { some: { company: { type: { in: ["PLATFORM", "CARRIER"] } } } } },
          ],
        },
        select: { id: true },
      })
    : [];
  const keep = new Set(protectedUsers.map((row) => row.id));
  const removable = candidateIds.filter((id) => !keep.has(id));
  await detachUsers(db, removable);
  await deleteCompanies(db, companyIds);
  if (filled(removable)) await db.user.deleteMany({ where: { id: { in: removable } } });
}

async function runSection(db: Db, section: PurgeSectionId) {
  switch (section) {
    case "loads":
      return purgeLoads(db);
    case "invoices":
      return purgeInvoices(db);
    case "drivers":
      return purgeDrivers(db);
    case "owners":
      return purgeOwners(db);
    case "chats":
      await db.message.deleteMany();
      await db.conversationParticipant.deleteMany();
      await db.conversation.deleteMany();
      return;
    case "notifications":
      await db.notification.deleteMany();
      return;
    case "tickets":
      await db.ticketMessage.deleteMany();
      await db.supportTicket.deleteMany();
      return;
    case "documents":
      await db.document.deleteMany();
      return;
    case "logs":
      await db.auditLog.deleteMany();
      await db.statusHistory.deleteMany();
      await db.cancellation.deleteMany();
      return;
  }
}

function assertAdmin(actor: Actor) {
  if (!actor.isPlatformStaff) throw Errors.forbidden("پاک کردن داده‌ها فقط برای مدیر است");
  assertPermission(actor, "settings.manage");
}

export async function purgeSection(actor: Actor, section: PurgeSectionId) {
  assertAdmin(actor);
  const removed = await countSection(section);
  const keys = [...new Set(await filesFor(section))];
  try {
    await prisma.$transaction(async (tx) => runSection(tx, section), { timeout: 120_000, maxWait: 10_000 });
  } catch (error) {
    console.error("Section purge failed", section, error);
    throw Errors.conflict("این بخش پاک نشد. بخش‌های وابسته‌اش را اول پاک کنید و دوباره تلاش کنید.");
  }
  await Promise.all(keys.map((key) => FileService.delete(key)));
  await writeAudit({
    actor,
    action: "admin.section_purged",
    entityType: "System",
    entityId: section,
    newValue: { removed },
  });
  return { section, removed };
}
