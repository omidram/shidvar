import { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { nextNumber } from "@/server/numbering";
import { writeAudit, recordStatusChange } from "@/server/audit";
import {
  DRIVER_FORWARD_STATUSES,
  JOB_TRANSITIONS,
  assertTransition,
  detailsReleased,
} from "@/server/state-machines/transitions";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission, requireApprovedDriver } from "@/server/rbac/actor";
import { toDriverJobDto } from "@/server/logistics/redaction";
import type { TransportJobStatus } from "@prisma/client";
import { podSchema } from "@/lib/validation/logistics";
import { JOB_DELIVERY_DOC_TYPES, signatureUrlFromDocs } from "@/lib/documents";
import { listJobDeliveryDocs } from "@/server/domains/documents/document-service";
import { issueTransportDocuments } from "@/server/domains/finance/invoice-service";
import { createDispute } from "@/server/domains/ops/ops-service";
import { creditJobIncome } from "@/server/domains/finance/wallet-service";
import {
  DRIVER_TRIP_STATUSES,
  TRACKING_LIVE_STATUSES,
  assertDriverFreeForTrip,
  completeTracking,
  startTrackingForJob,
} from "@/server/domains/logistics/tracking-service";

export { podSchema };

function isJobParty(actor: Actor, job: { order: { supplierCompanyId: string; requesterCompanyId: string }; assignedDriverId: string | null }) {
  return (
    actor.isPlatformStaff ||
    actor.driverProfile?.id === job.assignedDriverId ||
    actor.memberships.some(
      (m) => m.companyId === job.order.supplierCompanyId || m.companyId === job.order.requesterCompanyId,
    )
  );
}

function serializeJob(job: Awaited<ReturnType<typeof loadJob>>, actor: Actor) {
  const assigned = Boolean(actor.driverProfile && job.assignedDriverId === actor.driverProfile.id);
  const privileged =
    actor.isPlatformStaff ||
    actor.memberships.some(
      (m) => m.companyId === job.order.supplierCompanyId || m.companyId === job.order.requesterCompanyId,
    );
  const pickup = job.pickupWarehouse?.address;
  const delivery = job.deliveryWarehouse?.address;
  const owner = job.order.requesterCompany;
  return {
    cargoOwner: {
      id: owner.id,
      name: owner.tradeName,
      legalName: owner.legalName,
      phone: privileged || assigned ? owner.phone : null,
      email: privileged || assigned ? owner.email : null,
    },
    cargoItems: (job.order.request?.items ?? []).map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitCode: item.unitCode,
      qualityNotes: item.qualityNotes,
      packagingNotes: item.packagingNotes,
    })),
    originCity: job.order.request?.originCity ?? pickup?.city ?? null,
    destinationCity: job.order.request?.destinationCity ?? delivery?.city ?? null,
    originLine1: privileged || assigned ? job.order.request?.originLine1 ?? pickup?.line1 ?? null : null,
    destinationLine1: privileged || assigned ? job.order.request?.destinationLine1 ?? delivery?.line1 ?? null : null,
    waybill: job.shipment?.trackingNumber ?? null,
    trackingActive: TRACKING_LIVE_STATUSES.includes(job.status as (typeof TRACKING_LIVE_STATUSES)[number]),
    requestId: job.order.request?.id ?? null,
    requestNumber: job.order.request?.number ?? null,
    requestNotes: job.order.request?.notes ?? null,
    pickupNotes: job.order.request?.pickupNotes ?? null,
    qualityNotes: job.order.request?.qualityNotes ?? null,
    packagingNotes: job.order.request?.packagingNotes ?? null,
    budgetAmount: job.order.request?.budgetAmount != null ? Number(job.order.request.budgetAmount) : null,
    currencyCode: job.currencyCode,
    assignedDriver:
      (privileged || assigned) && job.assignedDriver
        ? {
            id: job.assignedDriver.id,
            name: `${job.assignedDriver.user.firstName} ${job.assignedDriver.user.lastName}`.trim(),
            phone: job.assignedDriver.user.phone,
            licenseNumber: job.assignedDriver.licenseNumber,
            licenseType: job.assignedDriver.licenseType,
            ratingAvg: Number(job.assignedDriver.ratingAvg),
            completedJobs: job.assignedDriver.completedJobs,
            plateNumber: job.assignedVehicle?.plateNumber ?? job.assignedDriver.vehicles[0]?.vehicle.plateNumber ?? null,
            vehicleType: job.assignedVehicle?.vehicleType ?? job.assignedDriver.vehicles[0]?.vehicle.vehicleType ?? null,
          }
        : null,
    assignedVehicle: job.assignedVehicle
      ? {
          plateNumber: job.assignedVehicle.plateNumber,
          vehicleType: job.assignedVehicle.vehicleType,
          brand: job.assignedVehicle.brand,
          model: job.assignedVehicle.model,
          weightCapacity: Number(job.assignedVehicle.weightCapacity),
        }
      : null,
    invoices: privileged || assigned
      ? job.order.invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          type: invoice.type,
          status: invoice.status,
          total: Number(invoice.total),
          currencyCode: invoice.currencyCode,
        }))
      : [],
    ...toDriverJobDto({
    id: job.id,
    number: job.number,
    status: job.status,
    cargoWeight: Number(job.cargoWeight),
    cargoUnit: job.cargoUnit,
    requiredVehicleType: job.requiredVehicleType,
    compensationAmount: job.compensationAmount ? Number(job.compensationAmount) : null,
    pickupAt: job.pickupAt,
    deliveryDeadline: job.deliveryDeadline,
    assignedToViewer: assigned,
    privileged,
    pickup: pickup
      ? {
          city: pickup.city,
          region: pickup.region,
          line1: pickup.line1,
          contactName: owner.tradeName,
          contactPhone: owner.phone,
          latitude: pickup.latitude ? Number(pickup.latitude) : null,
          longitude: pickup.longitude ? Number(pickup.longitude) : null,
        }
        : owner
        ? {
            city: job.order.request.originCity ?? "نامشخص",
            region: job.order.request.originCity ?? "نامشخص",
            line1: job.order.request.originLine1 ?? "نشانی پس از قبول بار",
            contactName: owner.tradeName,
            contactPhone: owner.phone,
          }
        : null,
    delivery: delivery
      ? {
          city: delivery.city,
          region: delivery.region,
          line1: delivery.line1,
          contactName: job.order.requesterCompany.tradeName,
          contactPhone: job.order.requesterCompany.phone,
          latitude: delivery.latitude ? Number(delivery.latitude) : null,
          longitude: delivery.longitude ? Number(delivery.longitude) : null,
        }
      : null,
  }),
  };
}

async function loadJob(id: string) {
  const job = await prisma.transportationJob.findUnique({
    where: { id },
    include: {
      order: { include: { requesterCompany: true, supplierCompany: true, request: { include: { items: true } }, items: true, invoices: true } },
      pickupWarehouse: { include: { address: true } },
      deliveryWarehouse: { include: { address: true } },
      applications: {
        include: {
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      shipment: { include: { items: true, pod: true } },
      assignedDriver: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true, email: true } },
          vehicles: { include: { vehicle: { select: { plateNumber: true, vehicleType: true } } } },
        },
      },
      assignedVehicle: true,
    },
  });
  if (!job) throw Errors.notFound();
  return job;
}

export async function listDriverMarketplace(actor: Actor) {
  assertPermission(actor, "marketplace.driver.read");
  const driver = requireApprovedDriver(actor);
  const matches = await prisma.driverMatch.findMany({
    where: { driverId: driver.id, eligible: true },
    include: { job: true },
    orderBy: { score: "desc" },
  });
  const cards = [];
  for (const match of matches) {
    if (!["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"].includes(match.job.status)) continue;
    const declined = await prisma.driverApplication.findUnique({
      where: { jobId_driverId: { jobId: match.job.id, driverId: driver.id } },
    });
    if (declined?.status === "REJECTED") continue;
    const job = await loadJob(match.job.id);
    cards.push({ ...serializeJob(job, actor), matchScore: match.score });
  }
  return cards;
}

export async function getJob(actor: Actor, id: string) {
  const job = await loadJob(id);
  const isParty = isJobParty(actor, job);
  const matched =
    actor.driverProfile &&
    (await prisma.driverMatch.findUnique({
      where: { jobId_driverId: { jobId: id, driverId: actor.driverProfile.id } },
    }));
  if (!isParty && !matched?.eligible) throw Errors.notFound();
  const deliveryDocs = isParty ? await listJobDeliveryDocs(actor, id) : null;
  return {
    ...serializeJob(job, actor),
    applications: isParty && !actor.driverProfile ? job.applications : undefined,
    shipment: detailsReleased(job.status) && isParty ? job.shipment : undefined,
    deliveryDocs,
    signatures: deliveryDocs
      ? {
          issuer: signatureUrlFromDocs(deliveryDocs.items, "issuer"),
          driver: signatureUrlFromDocs(deliveryDocs.items, "driver"),
          receiver: signatureUrlFromDocs(deliveryDocs.items, "receiver"),
        }
      : null,
    orderNumber: job.order.number,
    items: job.order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unitCode: item.unitCode,
    })),
  };
}

export async function listJobsForActor(actor: Actor) {
  assertPermission(actor, "jobs.read");
  if (actor.driverProfile) {
    const jobs = await prisma.transportationJob.findMany({
      where: { assignedDriverId: actor.driverProfile.id },
      orderBy: { pickupAt: "asc" },
    });
    const cards = [];
    for (const row of jobs) {
      const job = await loadJob(row.id);
      cards.push(serializeJob(job, actor));
    }
    return cards;
  }
  const companyIds = actor.memberships.map((m) => m.companyId);
  const jobs = await prisma.transportationJob.findMany({
    where: actor.isPlatformStaff
      ? undefined
      : { order: { OR: [{ requesterCompanyId: { in: companyIds } }, { supplierCompanyId: { in: companyIds } }] } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const cards = [];
  for (const row of jobs) {
    const job = await loadJob(row.id);
    cards.push({
      ...serializeJob(job, actor),
      applications: job.applications,
      orderNumber: job.order.number,
    });
  }
  return cards;
}

export async function applyToJob(actor: Actor, jobId: string, notes?: string) {
  assertPermission(actor, "jobs.apply");
  const driver = requireApprovedDriver(actor);
  const job = await loadJob(jobId);
  const match = await prisma.driverMatch.findUnique({
    where: { jobId_driverId: { jobId, driverId: driver.id } },
  });
  if (!match?.eligible) throw Errors.forbidden("You were not matched to this job");
  if (!["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"].includes(job.status)) {
    throw Errors.conflict("Job is not open");
  }

  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.driverApplication.upsert({
      where: { jobId_driverId: { jobId, driverId: driver.id } },
      create: { jobId, driverId: driver.id, notes, status: "SUBMITTED" },
      update: { notes, status: "SUBMITTED" },
    });
    if (job.status === "OFFERED_TO_DRIVERS") {
      await tx.transportationJob.update({
        where: { id: jobId, status: "OFFERED_TO_DRIVERS" },
        data: { status: "DRIVER_APPLIED", version: { increment: 1 } },
      });
    }
    return created;
  });
  await writeAudit({ actor, action: "job.applied", entityType: "TransportationJob", entityId: jobId });
  return application;
}

export async function selectDriver(actor: Actor, jobId: string, driverId: string) {
  assertPermission(actor, "jobs.assign");
  const job = await loadJob(jobId);
  if (
    !actor.isPlatformStaff &&
    !actor.memberships.some(
      (m) => m.companyId === job.order.supplierCompanyId || m.companyId === job.order.requesterCompanyId,
    )
  ) {
    throw Errors.forbidden();
  }
  const application = await prisma.driverApplication.findUnique({
    where: { jobId_driverId: { jobId, driverId } },
  });
  if (!application || application.status !== "SUBMITTED") throw Errors.conflict("Driver has not applied");
  await assertDriverFreeForTrip(driverId);

  const updated = await prisma.transportationJob.updateMany({
    where: {
      id: jobId,
      assignedDriverId: null,
      status: { in: ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"] },
    },
    data: { assignedDriverId: driverId, status: "DRIVER_SELECTED", version: { increment: 1 } },
  });
  if (updated.count !== 1) throw Errors.conflict("Job is no longer available");

  await prisma.driverApplication.update({ where: { id: application.id }, data: { status: "SELECTED" } });
  await prisma.driverApplication.updateMany({
    where: { jobId, id: { not: application.id }, status: "SUBMITTED" },
    data: { status: "REJECTED" },
  });
  await writeAudit({ actor, action: "job.driver_selected", entityType: "TransportationJob", entityId: jobId, newValue: { driverId } });
  return { jobId, driverId, status: "DRIVER_SELECTED" };
}

export async function confirmDriver(actor: Actor, jobId: string) {
  assertPermission(actor, "jobs.confirm");
  const job = await loadJob(jobId);
  if (
    !actor.isPlatformStaff &&
    !actor.memberships.some(
      (m) => m.companyId === job.order.supplierCompanyId || m.companyId === job.order.requesterCompanyId,
    )
  ) {
    throw Errors.forbidden();
  }
  assertTransition(JOB_TRANSITIONS, job.status, "SUPPLIER_CONFIRMED");
  if (!job.assignedDriverId) throw Errors.conflict("No driver selected");
  const driverId = job.assignedDriverId;

  await prisma.$transaction(async (tx) => {
    await tx.transportationJob.update({
      where: { id: jobId, status: job.status, version: job.version },
      data: {
        status: "SUPPLIER_CONFIRMED",
        detailsReleasedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.driverApplication.updateMany({
      where: { jobId, driverId, status: "SELECTED" },
      data: { status: "CONFIRMED" },
    });
    await tx.shipment.create({
      data: {
        trackingNumber: await nextNumber("SHP"),
        jobId,
        status: "SCHEDULED",
        items: {
          create: job.order.items.map((item) => ({
            requestItemId: item.requestItemId,
            requestedQuantity: item.quantity,
            remainingQuantity: item.quantity,
            unitCode: item.unitCode,
          })),
        },
      },
    });
    await tx.transportationJob.update({
      where: { id: jobId },
      data: { status: "DRIVER_ASSIGNED", version: { increment: 1 } },
    });
    await tx.procurementRequest.update({
      where: { id: job.order.requestId },
      data: { status: "TRANSPORT_ASSIGNED", version: { increment: 1 } },
    });
    await tx.order.update({
      where: { id: job.orderId },
      data: { status: "IN_FULFILLMENT", version: { increment: 1 } },
    });
  });

  await recordStatusChange({
    entityType: "TransportationJob",
    entityId: jobId,
    from: job.status,
    to: "SUPPLIER_CONFIRMED",
    actorId: actor.userId,
  });
  await writeAudit({ actor, action: "job.driver_confirmed", entityType: "TransportationJob", entityId: jobId });
  return getJob(actor, jobId);
}

export const statusSchema = z.object({
  status: z.custom<TransportJobStatus>(),
  note: z.string().optional(),
});

export async function updateJobStatus(actor: Actor, jobId: string, to: TransportJobStatus, note?: string) {
  assertPermission(actor, "jobs.update_status");
  const job = await loadJob(jobId);
  const isAssignedDriver = actor.driverProfile?.id === job.assignedDriverId;
  if (!actor.isPlatformStaff && !isAssignedDriver) throw Errors.forbidden();
  if (isAssignedDriver && !DRIVER_FORWARD_STATUSES.includes(to) && to !== "PROOF_SUBMITTED") {
    throw Errors.forbidden("Drivers can only move the trip forward");
  }
  if (DRIVER_TRIP_STATUSES.includes(to as (typeof DRIVER_TRIP_STATUSES)[number]) && job.assignedDriverId) {
    await assertDriverFreeForTrip(job.assignedDriverId, jobId);
  }
  assertTransition(JOB_TRANSITIONS, job.status, to);
  await prisma.transportationJob.update({
    where: { id: jobId, status: job.status, version: job.version },
    data: { status: to, version: { increment: 1 } },
  });
  if (job.shipment) {
    await prisma.shipment.update({ where: { id: job.shipment.id }, data: { status: to } });
  }
  if (to === "IN_TRANSIT") {
    await prisma.procurementRequest.update({
      where: { id: job.order.requestId, status: { in: ["TRANSPORT_ASSIGNED", "PICKUP_SCHEDULED"] } },
      data: { status: "IN_TRANSIT", version: { increment: 1 } },
    });
  }
  if (TRACKING_LIVE_STATUSES.includes(to as (typeof TRACKING_LIVE_STATUSES)[number]) || to === "LOADED") {
    await startTrackingForJob(jobId, { seedTrail: false });
  }
  if (["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(to)) {
    await completeTracking(jobId);
  }
  await recordStatusChange({
    entityType: "TransportationJob",
    entityId: jobId,
    from: job.status,
    to,
    actorId: actor.userId,
    note,
  });
  return getJob(actor, jobId);
}

export async function submitPod(actor: Actor, jobId: string, input: z.infer<typeof podSchema>) {
  const job = await loadJob(jobId);
  if (actor.driverProfile?.id !== job.assignedDriverId && !actor.isPlatformStaff) throw Errors.forbidden();
  if (!job.shipment) throw Errors.conflict("بارنامه هنوز صادر نشده است");
  if (job.status !== "DELIVERED") throw Errors.conflict("ثبت رسید فقط بعد از تحویل بار ممکن است");
  if (!detailsReleased(job.status)) throw Errors.forbidden();
  if (job.shipment.pod) throw Errors.conflict("رسید این بار قبلاً ثبت شده است");

  const docs = await prisma.document.findMany({
    where: {
      entityType: "TransportationJob",
      entityId: jobId,
      documentType: { in: [...JOB_DELIVERY_DOC_TYPES] },
    },
    orderBy: { createdAt: "desc" },
  });
  const hasReceipt = docs.some((doc) => doc.documentType === "JOB_POD_RECEIPT" && doc.verification !== "REJECTED");
  const hasWaybill = docs.some((doc) => doc.documentType === "JOB_SIGNED_WAYBILL" && doc.verification !== "REJECTED");
  if (!hasReceipt || !hasWaybill) {
    throw Errors.validation(
      { documents: ["تصویر رسید امضاشده و بارنامه امضاشده الزامی است"] },
      "تصویر رسید تحویل با امضای گیرنده و بارنامه امضاشده را بارگذاری کنید",
    );
  }
  const signedWaybill = docs.find((doc) => doc.documentType === "JOB_SIGNED_WAYBILL" && doc.verification !== "REJECTED");

  await prisma.$transaction(async (tx) => {
    for (const line of input.deliveredQuantities) {
      const item = job.shipment!.items.find((i) => i.id === line.shipmentItemId);
      if (!item) throw Errors.validation({ deliveredQuantities: ["Unknown shipment item"] });
      const remaining = Number(item.requestedQuantity) - line.quantity;
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: {
          deliveredQuantity: line.quantity,
          remainingQuantity: remaining,
          remainingDisposition: remaining > 0 ? "PENDING" : "CANCELLED",
        },
      });
    }
    await tx.proofOfDelivery.create({
      data: {
        shipmentId: job.shipment!.id,
        receiverName: input.receiverName,
        receiverIdNumber: input.receiverIdNumber,
        notes: input.notes,
        damageNotes: input.damageNotes,
        latitude: input.latitude,
        longitude: input.longitude,
        signatureStorageKey: input.signatureStorageKey ?? signedWaybill?.storageKey,
        deliveredAt: new Date(),
      },
    });
    await tx.transportationJob.update({
      where: { id: jobId },
      data: { status: "PROOF_SUBMITTED", version: { increment: 1 } },
    });
    await tx.shipment.update({ where: { id: job.shipment!.id }, data: { status: "PROOF_SUBMITTED" } });
    await tx.procurementRequest.update({
      where: { id: job.order.requestId },
      data: { status: "DELIVERED", version: { increment: 1 } },
    });
  });
  await writeAudit({ actor, action: "pod.submitted", entityType: "Shipment", entityId: job.shipment.id });
  const members = await prisma.membership.findMany({
    where: { companyId: job.order.requesterCompanyId, status: "ACTIVE" },
    select: { userId: true },
  });
  if (members.length) {
    await prisma.notification.createMany({
      data: members.map((row) => ({
        userId: row.userId,
        eventType: "job.pod",
        title: "رسید و بارنامه برای تأیید",
        body: `${job.number} منتظر تأیید مدارک تحویل است`,
        payload: { jobId, kind: "job.pod" },
      })),
    });
  }
  return getJob(actor, jobId);
}

export async function confirmDelivery(
  actor: Actor,
  jobId: string,
  resolution: "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED" | "DISPUTED",
  dispute?: { reason?: "DAMAGE" | "SHORTAGE" | "DELAY" | "OVERCHARGE" | "NO_SHOW" | "OTHER"; description?: string },
) {
  const job = await loadJob(jobId);
  if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === job.order.requesterCompanyId)) {
    throw Errors.forbidden();
  }
  if (!job.shipment?.pod) throw Errors.conflict("راننده هنوز رسید تحویل را ثبت نکرده است");
  const docs = await prisma.document.findMany({
    where: { entityType: "TransportationJob", entityId: jobId, documentType: { in: [...JOB_DELIVERY_DOC_TYPES] } },
  });
  if (!JOB_DELIVERY_DOC_TYPES.every((type) => docs.some((doc) => doc.documentType === type && doc.verification !== "REJECTED"))) {
    throw Errors.conflict("تصویر رسید امضاشده و بارنامه امضاشده هنوز کامل نیست");
  }
  await prisma.proofOfDelivery.update({
    where: { id: job.shipment.pod.id },
    data: { resolution, resolvedAt: new Date() },
  });
  const nextJob: TransportJobStatus = resolution === "REJECTED" || resolution === "DISPUTED" ? "DISPUTED" : "CONFIRMED";
  await prisma.transportationJob.update({
    where: { id: jobId },
    data: { status: nextJob === "CONFIRMED" ? "COMPLETED" : nextJob, version: { increment: 1 } },
  });
  if (nextJob === "CONFIRMED") {
    await prisma.order.update({ where: { id: job.orderId }, data: { status: "COMPLETED" } });
    await prisma.procurementRequest.update({
      where: { id: job.order.requestId },
      data: { status: "COMPLETED", version: { increment: 1 } },
    });
  }
  await writeAudit({ actor, action: "delivery.confirmed", entityType: "TransportationJob", entityId: jobId, newValue: { resolution } });
  if (resolution === "ACCEPTED" || resolution === "PARTIALLY_ACCEPTED") {
    await prisma.document.updateMany({
      where: { entityType: "TransportationJob", entityId: jobId, documentType: { in: [...JOB_DELIVERY_DOC_TYPES] } },
      data: { verification: "VERIFIED" },
    });
  }
  if (nextJob === "CONFIRMED" && job.assignedDriverId) {
    await creditJobIncome(job.assignedDriverId, jobId);
  }
  if (resolution === "DISPUTED") {
    await createDispute(actor, {
      jobId,
      reason: dispute?.reason ?? "OTHER",
      description: dispute?.description ?? "تحویل مورد اختلاف قرار گرفت",
    });
  }
  return getJob(actor, jobId);
}

export async function returnDeliveryDocs(actor: Actor, jobId: string, note?: string) {
  const job = await loadJob(jobId);
  if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === job.order.requesterCompanyId)) {
    throw Errors.forbidden();
  }
  if (job.status !== "PROOF_SUBMITTED") throw Errors.conflict("فقط قبل از تأیید نهایی می‌توان مدارک را برای اصلاح برگرداند");
  assertTransition(JOB_TRANSITIONS, job.status, "DELIVERED");
  if (job.shipment?.pod) {
    await prisma.proofOfDelivery.delete({ where: { id: job.shipment.pod.id } });
  }
  await prisma.document.updateMany({
    where: { entityType: "TransportationJob", entityId: jobId, documentType: { in: [...JOB_DELIVERY_DOC_TYPES] } },
    data: { verification: "REJECTED" },
  });
  await prisma.transportationJob.update({
    where: { id: jobId },
    data: { status: "DELIVERED", version: { increment: 1 } },
  });
  if (job.shipment) {
    await prisma.shipment.update({ where: { id: job.shipment.id }, data: { status: "DELIVERED" } });
  }
  await recordStatusChange({
    entityType: "TransportationJob",
    entityId: jobId,
    from: job.status,
    to: "DELIVERED",
    actorId: actor.userId,
    note: note || "مدارک تحویل برای اصلاح به راننده برگشت",
  });
  await writeAudit({ actor, action: "pod.returned", entityType: "TransportationJob", entityId: jobId });
  if (job.assignedDriver?.userId) {
    await prisma.notification.create({
      data: {
        userId: job.assignedDriver.userId,
        eventType: "job.pod",
        title: "مدارک تحویل نیاز به اصلاح دارد",
        body: note?.trim() || `${job.number}: رسید یا بارنامه را دوباره بارگذاری کنید`,
        payload: { jobId, kind: "job.pod" },
      },
    });
  }
  return getJob(actor, jobId);
}

export async function listAssignedJobs(actor: Actor) {
  if (!actor.driverProfile) return [];
  return prisma.transportationJob.findMany({
    where: { assignedDriverId: actor.driverProfile.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    orderBy: { pickupAt: "asc" },
  });
}

export async function acceptCargoJob(actor: Actor, jobId: string) {
  assertPermission(actor, "jobs.apply");
  const driver = requireApprovedDriver(actor);
  const job = await loadJob(jobId);
  const match = await prisma.driverMatch.findUnique({
    where: { jobId_driverId: { jobId, driverId: driver.id } },
  });
  if (!match?.eligible) throw Errors.forbidden("این بار برای شما ارسال نشده است");
  if (!["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"].includes(job.status) || job.assignedDriverId) {
    throw Errors.conflict("این بار دیگر قابل قبول نیست");
  }
  await assertDriverFreeForTrip(driver.id);

  const updated = await prisma.transportationJob.updateMany({
    where: { id: jobId, assignedDriverId: null, status: { in: ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"] } },
    data: { assignedDriverId: driver.id, status: "DRIVER_SELECTED", version: { increment: 1 } },
  });
  if (updated.count !== 1) throw Errors.conflict("راننده دیگری این بار را قبول کرده است");

  await prisma.driverApplication.upsert({
    where: { jobId_driverId: { jobId, driverId: driver.id } },
    create: { jobId, driverId: driver.id, status: "SELECTED" },
    update: { status: "SELECTED" },
  });
  await prisma.driverApplication.updateMany({
    where: { jobId, driverId: { not: driver.id }, status: "SUBMITTED" },
    data: { status: "REJECTED" },
  });

  await confirmDriver({ ...actor, isPlatformStaff: true, permissions: new Set([...actor.permissions, "jobs.confirm"]) }, jobId);
  await issueTransportDocuments(job.orderId, jobId);
  await writeAudit({ actor, action: "job.accepted_by_driver", entityType: "TransportationJob", entityId: jobId });
  return getJob(actor, jobId);
}

export async function rejectCargoJob(actor: Actor, jobId: string) {
  assertPermission(actor, "jobs.apply");
  const driver = requireApprovedDriver(actor);
  await prisma.driverApplication.upsert({
    where: { jobId_driverId: { jobId, driverId: driver.id } },
    create: { jobId, driverId: driver.id, status: "REJECTED", notes: "rejected_by_driver" },
    update: { status: "REJECTED", notes: "rejected_by_driver" },
  });
  await writeAudit({ actor, action: "job.rejected_by_driver", entityType: "TransportationJob", entityId: jobId });
  return { jobId, status: "REJECTED" };
}
