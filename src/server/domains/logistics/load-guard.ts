import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { ACTIVE_LOAD_STATUSES, evaluateLoadAcceptance, type LoadCheck } from "@/server/logistics/load-rules";

const destinationSelect = {
  id: true,
  order: { select: { request: { select: { destinationCity: true } } } },
  deliveryWarehouse: { select: { address: { select: { city: true } } } },
} as const;

type DestinationRow = {
  order: { request: { destinationCity: string | null } | null };
  deliveryWarehouse: { address: { city: string } } | null;
};

export function destinationOf(job: DestinationRow) {
  return job.order.request?.destinationCity ?? job.deliveryWarehouse?.address.city ?? null;
}

export async function activeLoadDestinations(driverId: string, exceptJobId?: string, statuses: readonly string[] = ACTIVE_LOAD_STATUSES) {
  const rows = await prisma.transportationJob.findMany({
    where: {
      assignedDriverId: driverId,
      status: { in: [...statuses] as never },
      ...(exceptJobId ? { id: { not: exceptJobId } } : {}),
    },
    select: destinationSelect,
  });
  return rows.map(destinationOf);
}

export async function jobDestination(jobId: string) {
  const job = await prisma.transportationJob.findUnique({ where: { id: jobId }, select: destinationSelect });
  return job ? destinationOf(job) : null;
}

export async function checkDriverLoad(driverId: string, jobId: string): Promise<LoadCheck> {
  const [active, target, job, match] = await Promise.all([
    activeLoadDestinations(driverId, jobId),
    jobDestination(jobId),
    prisma.transportationJob.findUnique({
      where: { id: jobId },
      select: { order: { select: { request: { select: { dispatchMode: true, vipDriverId: true } } } } },
    }),
    prisma.driverMatch.findUnique({
      where: { jobId_driverId: { jobId, driverId } },
      select: { breakdown: true },
    }),
  ]);
  const request = job?.order.request;
  const breakdown = match?.breakdown as { vip?: boolean } | null;
  const assignedByAdmin = Boolean((request?.dispatchMode === "VIP" && request.vipDriverId === driverId) || breakdown?.vip);
  return evaluateLoadAcceptance(active, target, assignedByAdmin);
}

export async function assertDriverCanTakeLoad(driverId: string, jobId: string) {
  const check = await checkDriverLoad(driverId, jobId);
  if (!check.allowed) throw Errors.conflict(check.reason ?? "راننده بار فعال دیگری دارد");
  return check;
}
