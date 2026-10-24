import type { PrismaClient } from "@prisma/client";
import { ACTIVE_LOAD_STATUSES, normalizeCity } from "../src/server/logistics/load-rules";

export async function enforceSingleActiveLoad(prisma: PrismaClient) {
  const jobs = await prisma.transportationJob.findMany({
    where: { assignedDriverId: { not: null }, status: { in: [...ACTIVE_LOAD_STATUSES] } },
    include: {
      shipment: { select: { id: true } },
      order: { select: { id: true, requestId: true, request: { select: { destinationCity: true } } } },
      deliveryWarehouse: { select: { address: { select: { city: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const byDriver = new Map<string, typeof jobs>();
  for (const job of jobs) {
    byDriver.set(job.assignedDriverId!, [...(byDriver.get(job.assignedDriverId!) ?? []), job]);
  }

  const rank = (status: string) => ACTIVE_LOAD_STATUSES.indexOf(status as (typeof ACTIVE_LOAD_STATUSES)[number]);
  const destination = (job: (typeof jobs)[number]) =>
    normalizeCity(job.order.request?.destinationCity ?? job.deliveryWarehouse?.address.city);

  let released = 0;
  for (const [driverId, list] of byDriver) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => Number(Boolean(b.shipment)) - Number(Boolean(a.shipment)) || rank(b.status) - rank(a.status));
    const keepCity = destination(sorted[0]);
    for (const job of sorted.slice(1)) {
      if (keepCity && destination(job) === keepCity) continue;
      if (job.shipment) continue;
      await prisma.transportationJob.update({
        where: { id: job.id },
        data: { assignedDriverId: null, assignedVehicleId: null, status: "OFFERED_TO_DRIVERS", detailsReleasedAt: null, version: { increment: 1 } },
      });
      await prisma.driverApplication.updateMany({ where: { jobId: job.id, driverId }, data: { status: "WITHDRAWN" } });
      await prisma.order.update({ where: { id: job.order.id }, data: { status: "AWAITING_TRANSPORT" } });
      if (job.order.requestId) {
        await prisma.procurementRequest.update({ where: { id: job.order.requestId }, data: { status: "TRANSPORT_PENDING" } });
      }
      released += 1;
    }
  }
  return released;
}
