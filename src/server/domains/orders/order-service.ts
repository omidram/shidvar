import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { detailsReleased } from "@/server/state-machines/transitions";
import { toDriverJobDto } from "@/server/logistics/redaction";

function canSeeOrder(actor: Actor, order: { requesterCompanyId: string; supplierCompanyId: string; jobs: Array<{ assignedDriverId: string | null }> }) {
  if (actor.isPlatformStaff) return true;
  if (actor.memberships.some((m) => m.companyId === order.requesterCompanyId || m.companyId === order.supplierCompanyId)) {
    return true;
  }
  return order.jobs.some((job) => job.assignedDriverId && job.assignedDriverId === actor.driverProfile?.id);
}

function isCommercialParty(actor: Actor, order: { requesterCompanyId: string; supplierCompanyId: string }) {
  return (
    actor.isPlatformStaff ||
    actor.memberships.some((m) => m.companyId === order.requesterCompanyId || m.companyId === order.supplierCompanyId)
  );
}

export async function listOrders(actor: Actor) {
  assertPermission(actor, "orders.read");
  const companyIds = actor.memberships.map((m) => m.companyId);
  const orders = await prisma.order.findMany({
    where: actor.isPlatformStaff
      ? undefined
      : actor.driverProfile
        ? {
            OR: [
              { requesterCompanyId: { in: companyIds } },
              { supplierCompanyId: { in: companyIds } },
              { jobs: { some: { assignedDriverId: actor.driverProfile.id } } },
            ],
          }
        : { OR: [{ requesterCompanyId: { in: companyIds } }, { supplierCompanyId: { in: companyIds } }] },
    include: { items: true, requesterCompany: true, supplierCompany: true, jobs: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return orders.map((order) => {
    if (isCommercialParty(actor, order)) return order;
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      currencyCode: order.currencyCode,
      createdAt: order.createdAt,
      jobs: order.jobs.map((job) => ({ id: job.id, number: job.number, status: job.status })),
    };
  });
}

export async function getOrderForActor(actor: Actor, id: string) {
  assertPermission(actor, "orders.read");
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      requesterCompany: true,
      supplierCompany: true,
      jobs: {
        include: {
          shipment: { include: { pod: true, items: true } },
          applications: {
            include: {
              driver: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
          pickupWarehouse: { include: { address: true } },
          deliveryWarehouse: { include: { address: true } },
        },
      },
      request: { include: { items: true } },
      invoices: true,
      ratings: true,
      disputes: true,
    },
  });
  if (!order || !canSeeOrder(actor, order)) throw Errors.notFound();

  const history = await prisma.statusHistory.findMany({
    where: { entityId: { in: [order.id, order.requestId, ...order.jobs.map((job) => job.id)] } },
    orderBy: { createdAt: "asc" },
  });

  if (isCommercialParty(actor, order)) {
    return { ...order, history };
  }

  const assignedJob = order.jobs.find((job) => job.assignedDriverId === actor.driverProfile?.id);
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    currencyCode: order.currencyCode,
    items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, unitCode: item.unitCode })),
    jobs: order.jobs
      .filter((job) => job.assignedDriverId === actor.driverProfile?.id)
      .map((job) => {
        const pickup = job.pickupWarehouse?.address;
        const delivery = job.deliveryWarehouse?.address;
        return toDriverJobDto({
          id: job.id,
          number: job.number,
          status: job.status,
          cargoWeight: Number(job.cargoWeight),
          cargoUnit: job.cargoUnit,
          requiredVehicleType: job.requiredVehicleType,
          compensationAmount: job.compensationAmount ? Number(job.compensationAmount) : null,
          pickupAt: job.pickupAt,
          deliveryDeadline: job.deliveryDeadline,
          assignedToViewer: true,
          privileged: false,
          pickup: pickup
            ? { city: pickup.city, region: pickup.region, line1: pickup.line1 }
            : null,
          delivery: delivery
            ? { city: delivery.city, region: delivery.region, line1: delivery.line1 }
            : null,
        });
      }),
    history: assignedJob && detailsReleased(assignedJob.status) ? history : history.map((row) => ({ ...row, note: null })),
  };
}
