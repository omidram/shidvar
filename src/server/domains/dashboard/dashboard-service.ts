import { prisma } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";

export async function dashboardFor(actor: Actor) {
  if (actor.isPlatformStaff) {
    const [
      users,
      suppliers,
      drivers,
      pendingCompanies,
      pendingDrivers,
      activeRequests,
      activeJobs,
      completedOrders,
      cancelledOrders,
      disputes,
      tickets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count({ where: { type: "REQUESTER", status: "APPROVED" } }),
      prisma.driverProfile.count({ where: { status: "APPROVED" } }),
      prisma.company.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
      prisma.driverProfile.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
      prisma.procurementRequest.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED", "DRAFT"] } } }),
      prisma.transportationJob.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER"] } } }),
    ]);
    return {
      portal: "PLATFORM",
      stats: {
        users,
        cargoOwners: suppliers,
        drivers,
        pendingApprovals: pendingCompanies + pendingDrivers,
        activeRequests,
        activeShipments: activeJobs,
        completedOrders,
        cancelledOrders,
        disputes,
        openTickets: tickets,
      },
    };
  }

  const requesterId = actor.memberships.find((m) => m.companyType === "REQUESTER")?.companyId;
  if (requesterId && actor.portal !== "SUPPLIER" && actor.portal !== "DRIVER") {
    const [activeRequests, waitingDrivers, assignedLoads, invoices, unpaidInvoices, openDisputes] = await Promise.all([
      prisma.procurementRequest.count({ where: { companyId: requesterId, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.transportationJob.count({
        where: {
          order: { requesterCompanyId: requesterId },
          assignedDriverId: null,
          status: { in: ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING"] },
        },
      }),
      prisma.transportationJob.count({
        where: { order: { requesterCompanyId: requesterId }, assignedDriverId: { not: null }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.invoice.count({ where: { recipientCompanyId: requesterId } }),
      prisma.invoice.count({
        where: { recipientCompanyId: requesterId, status: { in: ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      }),
      prisma.dispute.count({
        where: { order: { requesterCompanyId: requesterId }, status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"] } },
      }),
    ]);
    return { portal: "REQUESTER", stats: { activeRequests, waitingDrivers, assignedLoads, invoices, unpaidInvoices, openDisputes } };
  }

  const supplierId = actor.memberships.find((m) => m.companyType === "SUPPLIER")?.companyId;
  if (supplierId && !actor.driverProfile) {
    const [matches, offers, orders, shipments] = await Promise.all([
      prisma.supplierMatch.count({ where: { supplierCompanyId: supplierId, eligible: true } }),
      prisma.supplierOffer.count({ where: { supplierCompanyId: supplierId, status: "SUBMITTED" } }),
      prisma.order.count({ where: { supplierCompanyId: supplierId, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.transportationJob.count({ where: { order: { supplierCompanyId: supplierId }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    ]);
    return { portal: "SUPPLIER", stats: { matchedRequests: matches, pendingOffers: offers, acceptedOrders: orders, activeShipments: shipments } };
  }

  if (actor.driverProfile) {
    const [available, accepted, earnings, profile] = await Promise.all([
      prisma.driverMatch.count({ where: { driverId: actor.driverProfile.id, eligible: true } }),
      prisma.transportationJob.count({
        where: { assignedDriverId: actor.driverProfile.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.transportationJob.aggregate({
        where: {
          assignedDriverId: actor.driverProfile.id,
          status: { in: ["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"] },
        },
        _sum: { compensationAmount: true },
      }),
      prisma.driverProfile.findUnique({
        where: { id: actor.driverProfile.id },
        select: { ratingAvg: true, ratingCount: true },
      }),
    ]);
    return {
      portal: "DRIVER",
      stats: {
        availableJobs: available,
        activeJobs: accepted,
        earnings: Number(earnings._sum.compensationAmount ?? 0),
        rating: profile?.ratingCount ? Number(profile.ratingAvg) : null,
      },
    };
  }

  return { portal: "UNKNOWN", stats: {} };
}

export async function listNotifications(actor: Actor) {
  return prisma.notification.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(actor: Actor, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId: actor.userId },
    data: { readAt: new Date() },
  });
  return { id, read: true };
}
