import type { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { nextNumber } from "@/server/numbering";
import { writeAudit, recordStatusChange } from "@/server/audit";
import { assertTransition, OFFER_TRANSITIONS, REQUEST_TRANSITIONS, ORDER_TRANSITIONS } from "@/server/state-machines/transitions";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission, requireApprovedSupplier, requireRequesterCompany } from "@/server/rbac/actor";
import { getRule } from "@/server/settings/rules";
import { runDriverMatching } from "@/server/domains/matching/run-driver-matching";
import { offerSchema } from "@/lib/validation/procurement";

export { offerSchema };

export async function listOffers(actor: Actor) {
  assertPermission(actor, "offers.read");
  if (actor.isPlatformStaff) {
    return prisma.supplierOffer.findMany({
      include: { items: true, supplierCompany: true, request: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  const supplierId = actor.memberships.find((m) => m.companyType === "SUPPLIER")?.companyId;
  if (supplierId) {
    return prisma.supplierOffer.findMany({
      where: { supplierCompanyId: supplierId },
      include: { items: true, request: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  const requesterId = requireRequesterCompany(actor);
  return prisma.supplierOffer.findMany({
    where: { request: { companyId: requesterId } },
    include: { items: true, supplierCompany: true, request: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listMarketplaceRequests(actor: Actor) {
  assertPermission(actor, "marketplace.supplier.read");
  const companyId = requireApprovedSupplier(actor);
  if (!companyId) throw Errors.forbidden();
  const matches = await prisma.supplierMatch.findMany({
    where: { supplierCompanyId: companyId, eligible: true },
    include: {
      request: { include: { items: true, company: true } },
    },
    orderBy: { score: "desc" },
  });
  return matches
    .filter((m) => ["MATCHING", "SUPPLIER_RESPONDED"].includes(m.request.status))
    .map((m) => ({ ...m.request, matchScore: m.score, matchBreakdown: m.breakdown }));
}

export async function submitOffer(actor: Actor, requestId: string, input: z.infer<typeof offerSchema>) {
  assertPermission(actor, "offers.create");
  const supplierCompanyId = requireApprovedSupplier(actor);
  if (!supplierCompanyId) throw Errors.forbidden();

  const request = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: { items: true, matches: true },
  });
  if (!request) throw Errors.notFound();
  if (!["MATCHING", "SUPPLIER_RESPONDED"].includes(request.status)) {
    throw Errors.conflict("Request is not open for offers");
  }
  const match = request.matches.find((m) => m.supplierCompanyId === supplierCompanyId && m.eligible);
  if (!match) throw Errors.forbidden("This request was not matched to your company");

  const maxHours = await getRule<number>("offers.maxValidityHours", 72);
  const hours = Math.min(input.validHours ?? maxHours, maxHours);
  const allowPartial = await getRule<boolean>("offers.allowPartialQuantity", true);

  let total = 0;
  const items = input.items.map((line) => {
    const reqItem = request.items.find((i) => i.id === line.requestItemId);
    if (!reqItem) throw Errors.validation({ items: ["Unknown request item"] });
    const min = Number(reqItem.minQuantity);
    const max = Number(reqItem.maxQuantity);
    if (line.quantity < min || line.quantity > max) {
      throw Errors.validation({ items: [`Quantity for ${reqItem.name} must be between ${min} and ${max}`] });
    }
    if (!allowPartial && line.quantity !== Number(reqItem.quantity)) {
      throw Errors.validation({ items: ["Partial quantity offers are disabled"] });
    }
    const lineTotal = line.quantity * line.unitPrice;
    total += lineTotal;
    return { ...line, lineTotal };
  });

  const existing = await prisma.supplierOffer.findFirst({
    where: { requestId, supplierCompanyId, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } },
  });
  if (existing) throw Errors.conflict("You already have an active offer on this request");

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierOffer.create({
      data: {
        number: await nextNumber("OF"),
        requestId,
        supplierCompanyId,
        status: "SUBMITTED",
        currencyCode: request.currencyCode,
        totalAmount: total,
        pickupDate: input.pickupDate ? new Date(input.pickupDate) : undefined,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
        terms: input.terms,
        notes: input.notes,
        validUntil: new Date(Date.now() + hours * 60 * 60 * 1000),
        items: {
          create: items.map((line) => ({
            requestItemId: line.requestItemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: { items: true },
    });
    if (request.status === "MATCHING") {
      assertTransition(REQUEST_TRANSITIONS, "MATCHING", "SUPPLIER_RESPONDED");
      await tx.procurementRequest.update({
        where: { id: requestId, status: "MATCHING" },
        data: { status: "SUPPLIER_RESPONDED", version: { increment: 1 } },
      });
    }
    return created;
  });

  await writeAudit({ actor, action: "offer.submitted", entityType: "SupplierOffer", entityId: offer.id });
  return offer;
}

export async function acceptOffer(actor: Actor, offerId: string) {
  assertPermission(actor, "offers.accept");
  const offer = await prisma.supplierOffer.findUnique({
    where: { id: offerId },
    include: { items: true, request: { include: { items: true } } },
  });
  if (!offer) throw Errors.notFound();
  if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === offer.request.companyId)) {
    throw Errors.notFound();
  }
  assertTransition(OFFER_TRANSITIONS, offer.status, "ACCEPTED");
  assertTransition(REQUEST_TRANSITIONS, offer.request.status, "SUPPLIER_SELECTED");

  const singleWinner = await getRule<boolean>("fulfillment.singleWinner", true);

  const result = await prisma.$transaction(async (tx) => {
    const accepted = await tx.supplierOffer.updateMany({
      where: { id: offerId, status: offer.status, version: offer.version },
      data: { status: "ACCEPTED", version: { increment: 1 } },
    });
    if (accepted.count !== 1) throw Errors.conflict("Offer could not be accepted");

    if (singleWinner) {
      await tx.supplierOffer.updateMany({
        where: { requestId: offer.requestId, id: { not: offerId }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "DRAFT"] } },
        data: { status: "REJECTED" },
      });
    }

    await tx.procurementRequest.update({
      where: { id: offer.requestId, status: offer.request.status },
      data: { status: "SUPPLIER_SELECTED", version: { increment: 1 } },
    });

    const order = await tx.order.create({
      data: {
        number: await nextNumber("ORD"),
        requestId: offer.requestId,
        offerId: offer.id,
        requesterCompanyId: offer.request.companyId,
        supplierCompanyId: offer.supplierCompanyId,
        status: "CONFIRMED",
        currencyCode: offer.currencyCode,
        merchandiseTotal: offer.totalAmount,
        items: {
          create: offer.items.map((line) => {
            const reqItem = offer.request.items.find((i) => i.id === line.requestItemId);
            return {
              requestItemId: line.requestItemId,
              name: reqItem?.name ?? "Item",
              quantity: line.quantity,
              unitCode: reqItem?.unitCode ?? "ton",
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            };
          }),
        },
      },
    });

    assertTransition(ORDER_TRANSITIONS, "CREATED", "CONFIRMED");
    await tx.order.update({ where: { id: order.id }, data: { status: "AWAITING_TRANSPORT" } });
    await tx.procurementRequest.update({
      where: { id: offer.requestId },
      data: { status: "TRANSPORT_PENDING", version: { increment: 1 } },
    });

    const weight = offer.items.reduce((sum, line) => sum + Number(line.quantity), 0);
    const pickupWarehouse = await tx.warehouse.findFirst({
      where: { companyId: offer.supplierCompanyId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const job = await tx.transportationJob.create({
      data: {
        number: await nextNumber("JOB"),
        orderId: order.id,
        status: "CREATED",
        pickupWarehouseId: pickupWarehouse?.id,
        deliveryWarehouseId: offer.request.destinationWarehouseId,
        cargoWeight: weight,
        requiredVehicleType: weight >= 10 ? "HEAVY_TRUCK" : "TRUCK",
        pickupAt: offer.pickupDate,
        deliveryDeadline: offer.deliveryDate ?? offer.request.requestedDeliveryDate,
        currencyCode: offer.currencyCode,
      },
    });
    return { order, job };
  });

  await recordStatusChange({
    entityType: "SupplierOffer",
    entityId: offerId,
    from: offer.status,
    to: "ACCEPTED",
    actorId: actor.userId,
  });
  await writeAudit({ actor, action: "offer.accepted", entityType: "SupplierOffer", entityId: offerId });

  await prisma.transportationJob.update({
    where: { id: result.job.id },
    data: { status: "MATCHING" },
  });
  await runDriverMatching(result.job.id);
  await prisma.transportationJob.update({
    where: { id: result.job.id, status: "MATCHING" },
    data: { status: "OFFERED_TO_DRIVERS", version: { increment: 1 } },
  });

  return result;
}

export async function rejectOffer(actor: Actor, offerId: string, reason?: string) {
  assertPermission(actor, "offers.reject");
  const offer = await prisma.supplierOffer.findUnique({ where: { id: offerId }, include: { request: true } });
  if (!offer) throw Errors.notFound();
  if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === offer.request.companyId)) {
    throw Errors.notFound();
  }
  assertTransition(OFFER_TRANSITIONS, offer.status, "REJECTED");
  await prisma.supplierOffer.update({ where: { id: offerId }, data: { status: "REJECTED", notes: reason } });
  return { id: offerId, status: "REJECTED" };
}
