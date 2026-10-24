import type { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { nextNumber } from "@/server/numbering";
import { writeAudit, recordStatusChange } from "@/server/audit";
import { assertTransition, REQUEST_TRANSITIONS } from "@/server/state-machines/transitions";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission, requireRequesterCompany } from "@/server/rbac/actor";
import { getRule } from "@/server/settings/rules";
import { dispatchCargoToDrivers, redispatchOpenJob } from "@/server/domains/logistics/cargo-dispatch";
import { quotePrice } from "@/server/domains/finance/price-book-service";
import { moveCoins } from "@/server/domains/finance/coin-service";
import { announceRequestSchema, createRequestSchema } from "@/lib/validation/procurement";

export { announceRequestSchema, createRequestSchema };

export async function createRequest(actor: Actor, input: z.infer<typeof createRequestSchema>) {
  assertPermission(actor, "requests.create");
  const companyId = requireRequesterCompany(actor);
  if (!companyId) throw Errors.forbidden();
  const membership = actor.memberships.find((m) => m.companyId === companyId);
  if (!actor.isPlatformStaff && membership?.companyStatus !== "APPROVED") {
    throw Errors.forbidden("حساب شرکت پخش هنوز تأیید نشده است");
  }
  for (const item of input.items) {
    const min = item.minQuantity ?? item.quantity;
    const max = item.maxQuantity ?? item.quantity;
    if (min > item.quantity || max < item.quantity) {
      throw Errors.validation({ items: ["Quantity must sit between min and max"] });
    }
  }

  if (input.dispatchMode === "VIP") await assertVipDriver(input.vipDriverId);

  const qty = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const quote = await quotePrice(companyId, input.destinationCity, qty);
  const budgetAmount = input.budgetAmount ?? quote.amount ?? undefined;
  const number = await nextNumber("PR");
  const request = await prisma.procurementRequest.create({
    data: {
      number,
      companyId,
      destinationWarehouseId: input.destinationWarehouseId,
      createdById: actor.userId,
      requestedDeliveryDate: new Date(input.requestedDeliveryDate),
      budgetAmount,
      currencyCode: input.currencyCode,
      notes: input.notes,
      qualityNotes: input.qualityNotes,
      packagingNotes: input.packagingNotes,
      pickupNotes: input.pickupNotes ?? input.requiredVehicleType,
      originCity: input.originCity,
      destinationCity: input.destinationCity,
      originLine1: input.originLine1,
      destinationLine1: input.destinationLine1,
      dispatchMode: input.dispatchMode,
      vipDriverId: input.dispatchMode === "VIP" ? input.vipDriverId : null,
      needsWaybill: input.needsWaybill,
      needsInsurance: input.needsInsurance,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          categoryId: item.categoryId,
          name: item.name,
          quantity: item.quantity,
          minQuantity: item.minQuantity ?? item.quantity,
          maxQuantity: item.maxQuantity ?? item.quantity,
          unitCode: item.unitCode,
          qualityNotes: item.qualityNotes,
          packagingNotes: item.packagingNotes,
        })),
      },
      requirements: input.requiredCertifications?.length
        ? { create: input.requiredCertifications.map((value) => ({ kind: "CERTIFICATION", value })) }
        : undefined,
    },
    include: { items: true },
  });
  const cost = Math.max(0, Math.round(await getRule<number>("coins.createRequestCost", 100)));
  if (cost > 0) {
    try {
      await moveCoins({
        companyId,
        amount: -cost,
        kind: "SPEND",
        reason: `ثبت درخواست بار ${number}`,
        refType: "ProcurementRequest",
        refId: request.id,
        actorId: actor.userId,
      });
    } catch (error) {
      await prisma.procurementRequestItem.deleteMany({ where: { requestId: request.id } });
      await prisma.requestRequirement.deleteMany({ where: { requestId: request.id } });
      await prisma.procurementRequest.delete({ where: { id: request.id } });
      throw error;
    }
  }
  await writeAudit({
    actor,
    action: "request.created",
    entityType: "ProcurementRequest",
    entityId: request.id,
    newValue: { number },
  });
  return request;
}

export async function listRequests(actor: Actor) {
  assertPermission(actor, "requests.read");
  const where = actor.isPlatformStaff
    ? {}
    : { companyId: { in: actor.memberships.map((m) => m.companyId) } };
  return prisma.procurementRequest.findMany({
    where,
    include: {
      items: true,
      company: true,
      vipDriver: { include: { user: { select: { firstName: true, lastName: true } } } },
      orders: {
        include: {
          jobs: {
            include: {
              assignedDriver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getRequestForActor(actor: Actor, id: string) {
  const request = await prisma.procurementRequest.findUnique({
    where: { id },
    include: {
      items: true,
      offers: { include: { items: true, supplierCompany: true } },
      matches: true,
      company: true,
      requirements: true,
      vipDriver: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          vehicles: { include: { vehicle: { select: { plateNumber: true, vehicleType: true } } } },
        },
      },
      orders: {
        include: {
          invoices: true,
          jobs: {
            include: {
              assignedDriver: {
                include: {
                  user: { select: { firstName: true, lastName: true, phone: true, email: true } },
                  vehicles: { include: { vehicle: { select: { plateNumber: true, vehicleType: true, brand: true, model: true } } } },
                },
              },
              assignedVehicle: true,
              shipment: true,
              applications: { include: { driver: { include: { user: { select: { firstName: true, lastName: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!request) throw Errors.notFound();
  const owns = actor.memberships.some((m) => m.companyId === request.companyId);
  const matchedSupplier = request.matches.some((m) =>
    actor.memberships.some((mem) => mem.companyId === m.supplierCompanyId && m.eligible),
  );
  if (!actor.isPlatformStaff && !owns && !matchedSupplier) throw Errors.notFound();
  if (actor.isPlatformStaff || owns) return request;
  const supplierCompanyIds = actor.memberships.filter((m) => m.companyType === "SUPPLIER").map((m) => m.companyId);
  return {
    ...request,
    offers: request.offers.filter((offer) => supplierCompanyIds.includes(offer.supplierCompanyId)),
    matches: request.matches.filter((match) => supplierCompanyIds.includes(match.supplierCompanyId)),
  };
}

async function moveRequest(actor: Actor, id: string, to: Parameters<typeof assertTransition>[2], permission?: string) {
  if (permission) assertPermission(actor, permission);
  const request = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!request) throw Errors.notFound();
  if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === request.companyId)) {
    throw Errors.notFound();
  }
  assertTransition(REQUEST_TRANSITIONS, request.status, to as typeof request.status);
  const updated = await prisma.procurementRequest.update({
    where: { id, status: request.status, version: request.version },
    data: {
      status: to as typeof request.status,
      version: { increment: 1 },
      publishedAt: to === "PUBLISHED" || to === "MATCHING" ? new Date() : request.publishedAt,
    },
  });
  await recordStatusChange({
    entityType: "ProcurementRequest",
    entityId: id,
    from: request.status,
    to,
    actorId: actor.userId,
  });
  return updated;
}

export async function submitRequest(actor: Actor, id: string) {
  const request = await prisma.procurementRequest.findUnique({ where: { id }, include: { items: true, company: true } });
  if (!request) throw Errors.notFound();
  if (!request.items.length) throw Errors.validation({ items: ["At least one line is required"] });
  const adminAnnounce = await getRule<boolean>("requests.requireAdminAnnounce", true);
  const autoPublish = !adminAnnounce && (await getRule<boolean>("requests.autoPublish", true));
  await moveRequest(actor, id, "SUBMITTED", "requests.update");
  if (autoPublish) {
    return publishRequest(actor, id);
  }
  const updated = await moveRequest(actor, id, "UNDER_REVIEW", "requests.update");
  await notifyStaffOfRequest(request.id, request.number, request.company.tradeName, request.dispatchMode === "VIP");
  return updated;
}

async function notifyStaffOfRequest(requestId: string, number: string, companyName: string, vip: boolean) {
  const staff = await prisma.userRole.findMany({
    where: { role: { portal: "PLATFORM" } },
    select: { userId: true },
    distinct: ["userId"],
  });
  if (!staff.length) return;
  await prisma.notification.createMany({
    data: staff.map((s) => ({
      userId: s.userId,
      eventType: "request.review",
      title: vip ? "درخواست بار VIP برای اعلام" : "درخواست بار جدید برای اعلام",
      body: `${number} · ${companyName} منتظر بررسی و اعلام به رانندگان است`,
      payload: { kind: "request.review", requestId },
    })),
  });
}

async function assertVipDriver(driverId?: string | null) {
  if (!driverId) throw Errors.validation({ vipDriverId: ["برای اعلام VIP یک راننده انتخاب کنید"] });
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { status: true } });
  if (!driver || driver.status !== "APPROVED") {
    throw Errors.validation({ vipDriverId: ["راننده انتخاب‌شده تأییدشده نیست"] });
  }
}

export async function announceRequest(actor: Actor, id: string, input: z.infer<typeof announceRequestSchema>) {
  if (!actor.isPlatformStaff) throw Errors.forbidden("اعلام بار فقط با مدیریت است");
  assertPermission(actor, "requests.publish");
  const request = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!request) throw Errors.notFound();
  const redispatch = request.status === "TRANSPORT_PENDING";
  if (!redispatch && !["SUBMITTED", "UNDER_REVIEW", "PUBLISHED"].includes(request.status)) {
    throw Errors.conflict("این درخواست قبلاً اعلام شده یا قابل اعلام نیست");
  }
  if (input.dispatchMode === "VIP") await assertVipDriver(input.vipDriverId);
  if (redispatch) {
    const openJob = await prisma.transportationJob.findFirst({
      where: { order: { requestId: id }, assignedDriverId: null, status: { in: ["MATCHING", "OFFERED_TO_DRIVERS", "DRIVER_APPLIED"] } },
    });
    if (!openJob) throw Errors.conflict("راننده این بار مشخص شده و دیگر قابل اعلام مجدد نیست");
  }
  await prisma.procurementRequest.update({
    where: { id },
    data: {
      dispatchMode: input.dispatchMode,
      vipDriverId: input.dispatchMode === "VIP" ? input.vipDriverId : null,
      announcedAt: new Date(),
      version: { increment: 1 },
    },
  });
  await writeAudit({
    actor,
    action: "request.announced",
    entityType: "ProcurementRequest",
    entityId: id,
    newValue: { dispatchMode: input.dispatchMode, vipDriverId: input.vipDriverId ?? null },
  });
  if (redispatch) {
    await redispatchOpenJob(id);
    return getRequestForActor(actor, id);
  }
  return publishRequest(actor, id);
}

export async function listDriverDirectory(actor: Actor) {
  assertPermission(actor, "requests.create");
  const drivers = await prisma.driverProfile.findMany({
    where: { status: "APPROVED" },
    include: {
      user: { select: { firstName: true, lastName: true } },
      vehicles: { include: { vehicle: { select: { vehicleType: true, plateNumber: true } } } },
    },
    orderBy: [{ ratingAvg: "desc" }, { completedJobs: "desc" }],
    take: 200,
  });
  return drivers.map((d) => ({
    id: d.id,
    name: `${d.user.firstName} ${d.user.lastName}`.trim() || "راننده",
    ratingAvg: Number(d.ratingAvg),
    completedJobs: d.completedJobs,
    vehicleType: d.vehicles[0]?.vehicle.vehicleType ?? null,
    plateNumber: actor.isPlatformStaff ? d.vehicles[0]?.vehicle.plateNumber ?? null : null,
  }));
}

export async function publishRequest(actor: Actor, id: string) {
  const current = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!current) throw Errors.notFound();
  if (!actor.isPlatformStaff && (await getRule<boolean>("requests.requireAdminAnnounce", true))) {
    throw Errors.forbidden("اعلام بار به رانندگان با مدیریت است");
  }
  const perm = actor.isPlatformStaff ? "requests.review" : "requests.update";
  if (current.status === "SUBMITTED") {
    await moveRequest(actor, id, "UNDER_REVIEW", perm);
  }
  const afterReview = await prisma.procurementRequest.findUnique({ where: { id } });
  if (afterReview?.status === "UNDER_REVIEW") {
    await moveRequest(actor, id, "PUBLISHED", perm);
  }
  const afterPublish = await prisma.procurementRequest.findUnique({ where: { id } });
  if (afterPublish?.status === "PUBLISHED") {
    await moveRequest(actor, id, "MATCHING", perm);
  }
  await dispatchCargoToDrivers(id);
  await writeAudit({ actor, action: "request.published", entityType: "ProcurementRequest", entityId: id });
  return getRequestForActor(actor, id);
}

export async function cancelRequest(actor: Actor, id: string, reason: string) {
  const updated = await moveRequest(actor, id, "CANCELLED", "requests.cancel");
  await prisma.cancellation.create({
    data: { entityType: "ProcurementRequest", entityId: id, reason, actorId: actor.userId },
  });
  return updated;
}
