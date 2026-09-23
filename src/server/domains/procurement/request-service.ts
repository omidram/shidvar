import type { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { nextNumber } from "@/server/numbering";
import { writeAudit, recordStatusChange } from "@/server/audit";
import { assertTransition, REQUEST_TRANSITIONS } from "@/server/state-machines/transitions";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission, requireRequesterCompany } from "@/server/rbac/actor";
import { getRule } from "@/server/settings/rules";
import { dispatchCargoToDrivers } from "@/server/domains/logistics/cargo-dispatch";
import { quotePrice } from "@/server/domains/finance/price-book-service";
import { createRequestSchema } from "@/lib/validation/procurement";

export { createRequestSchema };

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
    include: { items: true, company: true },
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
  const request = await prisma.procurementRequest.findUnique({ where: { id }, include: { items: true } });
  if (!request) throw Errors.notFound();
  if (!request.items.length) throw Errors.validation({ items: ["At least one line is required"] });
  const autoPublish = await getRule<boolean>("requests.autoPublish", true);
  await moveRequest(actor, id, "SUBMITTED", "requests.update");
  if (autoPublish) {
    return publishRequest(actor, id);
  }
  return moveRequest(actor, id, "UNDER_REVIEW", "requests.update");
}

export async function publishRequest(actor: Actor, id: string) {
  const current = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!current) throw Errors.notFound();
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
