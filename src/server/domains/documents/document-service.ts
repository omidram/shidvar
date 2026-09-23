import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { actorCan } from "@/server/rbac/actor";
import { FileService } from "@/server/storage/file-service";
import { DOCUMENT_SLOTS, JOB_DELIVERY_DOC_TYPES, slotsFor, type DocumentSlot } from "@/lib/documents";

export type UploadInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  documentType: string;
  entityType: string;
  entityId: string;
};

function serialize(doc: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  entityType: string;
  entityId: string;
  documentType: string;
  verification: string;
  createdAt: Date;
}) {
  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    documentType: doc.documentType,
    entityType: doc.entityType,
    entityId: doc.entityId,
    verification: doc.verification,
    createdAt: doc.createdAt,
    url: `/api/v1/documents/download?id=${doc.id}`,
    isImage: doc.mimeType.startsWith("image/"),
  };
}

async function canAccessEntity(actor: Actor, entityType: string, entityId: string, write = false, documentType?: string) {
  if (actor.isPlatformStaff) return true;
  if (entityType === "DriverProfile") {
    if (actor.driverProfile?.id === entityId) return true;
    const driver = await prisma.driverProfile.findUnique({ where: { id: entityId } });
    return Boolean(driver && actor.memberships.some((m) => m.companyId === driver.carrierCompanyId));
  }
  if (entityType === "Vehicle") {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: entityId } });
    if (!vehicle) return false;
    if (actor.memberships.some((m) => m.companyId === vehicle.companyId)) return true;
    if (actor.driverProfile) {
      const link = await prisma.driverVehicle.findFirst({
        where: { vehicleId: entityId, driverId: actor.driverProfile.id },
      });
      return Boolean(link);
    }
    return false;
  }
  if (entityType === "Company") {
    const member = actor.memberships.find((m) => m.companyId === entityId);
    return Boolean(member && (!write || member.isOwner || actorCan(actor, "documents.upload")));
  }
  if (entityType === "TransportationJob") {
    const job = await prisma.transportationJob.findUnique({
      where: { id: entityId },
      include: { order: { select: { requesterCompanyId: true, supplierCompanyId: true } } },
    });
    if (!job) return false;
    const isDriver = actor.driverProfile?.id === job.assignedDriverId;
    const isRequester = actor.memberships.some((m) => m.companyId === job.order.requesterCompanyId);
    if (write) {
      const slot = DOCUMENT_SLOTS.find((item) => item.type === documentType);
      if (isDriver && job.status === "DELIVERED" && slot?.signatureRole !== "issuer") return true;
      if (isRequester && slot?.signatureRole === "issuer" && ["DELIVERED", "PROOF_SUBMITTED"].includes(job.status)) {
        return true;
      }
      return false;
    }
    return Boolean(isDriver || isRequester);
  }
  return false;
}

export async function uploadDocument(actor: Actor, input: UploadInput) {
  if (!DOCUMENT_SLOTS.some((slot) => slot.type === input.documentType)) {
    throw Errors.validation({ documentType: ["نوع مدرک نامعتبر است"] });
  }
  const allowed = await canAccessEntity(actor, input.entityType, input.entityId, true, input.documentType);
  if (!allowed) throw Errors.forbidden();
  const stored = await FileService.upload({
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalName: input.originalName,
  });
  const existing = await prisma.document.findFirst({
    where: { entityType: input.entityType, entityId: input.entityId, documentType: input.documentType },
    orderBy: { createdAt: "desc" },
  });
  const ownerCompanyId =
    input.entityType === "Company"
      ? input.entityId
      : actor.memberships[0]?.companyId ?? actor.driverProfile?.carrierCompanyId ?? null;
  const doc = await prisma.document.create({
    data: {
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      uploadedById: actor.userId,
      ownerCompanyId,
      entityType: input.entityType,
      entityId: input.entityId,
      documentType: input.documentType,
      verification: "PENDING",
    },
  });
  if (existing) {
    await prisma.document.delete({ where: { id: existing.id } }).catch(() => undefined);
    await FileService.delete(existing.storageKey);
  }
  return serialize(doc);
}

export async function listDocuments(actor: Actor, entityType: string, entityId: string) {
  const allowed = await canAccessEntity(actor, entityType, entityId, false);
  if (!allowed) throw Errors.forbidden();
  const rows = await prisma.document.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

export async function getDocumentForDownload(actor: Actor, id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw Errors.notFound();
  const allowed = await canAccessEntity(actor, doc.entityType, doc.entityId, false);
  if (!allowed) throw Errors.forbidden();
  const buffer = await FileService.read(doc.storageKey);
  return { buffer, mimeType: doc.mimeType, originalName: doc.originalName };
}

export async function deleteDocument(actor: Actor, id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw Errors.notFound();
  const allowed = await canAccessEntity(actor, doc.entityType, doc.entityId, true, doc.documentType);
  if (!allowed) throw Errors.forbidden();
  await prisma.document.delete({ where: { id } });
  await FileService.delete(doc.storageKey);
  return { deleted: true };
}

export async function verifyDocument(actor: Actor, id: string, verification: "VERIFIED" | "REJECTED") {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw Errors.notFound();
  if (!actor.isPlatformStaff) {
    if (doc.entityType !== "TransportationJob" || !JOB_DELIVERY_DOC_TYPES.includes(doc.documentType as (typeof JOB_DELIVERY_DOC_TYPES)[number])) {
      throw Errors.forbidden();
    }
    const allowed = await canAccessEntity(actor, doc.entityType, doc.entityId, false);
    if (!allowed) throw Errors.forbidden();
    const job = await prisma.transportationJob.findUnique({
      where: { id: doc.entityId },
      include: { order: { select: { requesterCompanyId: true } } },
    });
    if (!job || !actor.memberships.some((m) => m.companyId === job.order.requesterCompanyId)) {
      throw Errors.forbidden();
    }
  }
  const updated = await prisma.document.update({ where: { id }, data: { verification } });
  return serialize(updated);
}

function entityTypeForKind(kind: DocumentSlot["kinds"][number]) {
  if (kind === "company") return "Company";
  if (kind === "vehicle") return "Vehicle";
  if (kind === "job") return "TransportationJob";
  return "DriverProfile";
}

function latestByType(docs: Array<{ documentType: string }>) {
  const map = new Map<string, (typeof docs)[0]>();
  for (const doc of docs) {
    if (!map.has(doc.documentType)) map.set(doc.documentType, doc);
  }
  return map;
}

export async function buildChecklist(actor: Actor, kind: DocumentSlot["kinds"][number], entityId: string) {
  const entityType = entityTypeForKind(kind);
  const allowed = await canAccessEntity(actor, entityType, entityId, false);
  if (!allowed) throw Errors.forbidden();
  const docs = await prisma.document.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
  const latest = latestByType(docs);
  const slots = slotsFor(kind);
  return {
    kind,
    entityType,
    entityId,
    complete: slots.filter((s) => s.required).every((slot) => {
      const doc = latest.get(slot.type);
      if (!doc) return false;
      if (kind === "job" && "verification" in doc && doc.verification === "REJECTED") return false;
      return true;
    }),
    items: slots.map((slot) => ({
      ...slot,
      document: latest.has(slot.type) ? serialize(docs.find((d) => d.documentType === slot.type)!) : null,
    })),
  };
}

export async function listJobDeliveryDocs(actor: Actor, jobId: string) {
  return buildChecklist(actor, "job", jobId);
}

export async function getOwnChecklist(actor: Actor) {
  if (actor.driverProfile) {
    const driver = await buildChecklist(actor, "driver", actor.driverProfile.id);
    const vehicle = await prisma.driverVehicle.findFirst({
      where: { driverId: actor.driverProfile.id, isPrimary: true },
    });
    const vehicleCheck = vehicle ? await buildChecklist(actor, "vehicle", vehicle.vehicleId) : null;
    return { driver, vehicle: vehicleCheck, company: null };
  }
  const companyId = actor.memberships.find((m) => m.companyType === "REQUESTER")?.companyId;
  if (!companyId) return { driver: null, vehicle: null, company: null };
  return { driver: null, vehicle: null, company: await buildChecklist(actor, "company", companyId) };
}
