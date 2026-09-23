import { prisma } from "@/server/db";
import { scoreDriver } from "@/server/matching/driver-score";
import { DEFAULT_DRIVER_WEIGHTS, type DriverWeights } from "@/server/matching/weights";
import { getRule } from "@/server/settings/rules";

export async function runDriverMatching(jobId: string) {
  const job = await prisma.transportationJob.findUnique({
    where: { id: jobId },
    include: {
      pickupWarehouse: { include: { address: true } },
      deliveryWarehouse: { include: { address: true } },
    },
  });
  if (!job) return [];

  const weights = await getRule<DriverWeights>("matching.driver.weights", DEFAULT_DRIVER_WEIGHTS);
  const minScore = await getRule<number>("matching.minScoreToNotify", 40);
  const pickupPoint =
    job.pickupWarehouse?.address.latitude && job.pickupWarehouse.address.longitude
      ? {
          lat: Number(job.pickupWarehouse.address.latitude),
          lng: Number(job.pickupWarehouse.address.longitude),
        }
      : null;

  const destAreaId =
    job.pickupWarehouse?.address.geographicAreaId ?? job.deliveryWarehouse?.address.geographicAreaId ?? null;

  const drivers = await prisma.driverProfile.findMany({
    include: {
      vehicles: { include: { vehicle: true } },
      user: true,
    },
  });

  const results = [];
  for (const driver of drivers) {
    const areas = await prisma.operatingArea.findMany({
      where: { ownerType: "DRIVER", ownerId: driver.id },
      include: { geographicArea: true },
    });
    const vehicles = driver.vehicles.map((dv) => dv.vehicle);
    const scored = scoreDriver(
      {
        cargoWeight: Number(job.cargoWeight),
        requiredVehicleType: job.requiredVehicleType,
        requiredEquipment: [],
        pickupAreaIds: destAreaId ? [destAreaId] : [],
        pickupCity: job.pickupWarehouse?.address.city,
        pickupPoint,
        pickupAt: job.pickupAt,
      },
      {
        approved: driver.status === "APPROVED",
        suspended: driver.status === "SUSPENDED" || driver.status === "BLOCKED",
        vehicleTypes: vehicles.map((v) => v.vehicleType),
        maxWeight: Math.max(0, ...vehicles.map((v) => Number(v.weightCapacity))),
        equipment: vehicles.flatMap((v) => (Array.isArray(v.equipment) ? (v.equipment as string[]) : [])),
        areaIds: areas.map((a) => a.geographicAreaId),
        cities: areas.flatMap((a) => [a.geographicArea.nameEn, a.geographicArea.nameFa].filter(Boolean)),
        location:
          driver.lastKnownLat && driver.lastKnownLng
            ? { lat: Number(driver.lastKnownLat), lng: Number(driver.lastKnownLng) }
            : pickupPoint,
        ratingAvg: Number(driver.ratingAvg),
        onTimeRate: Number(driver.completedJobs > 0 ? 0.92 : 0.7),
        completedJobs: driver.completedJobs,
        openJobCount: driver.openJobCount,
        available: driver.status === "APPROVED" && vehicles.some((v) => v.status === "AVAILABLE"),
      },
      weights,
      minScore,
    );

    await prisma.driverMatch.upsert({
      where: { jobId_driverId: { jobId, driverId: driver.id } },
      create: {
        jobId,
        driverId: driver.id,
        score: scored.score,
        breakdown: scored.breakdown,
        eligible: scored.eligible,
        notifiedAt: scored.breakdown.notify ? new Date() : null,
      },
      update: {
        score: scored.score,
        breakdown: scored.breakdown,
        eligible: scored.eligible,
        notifiedAt: scored.breakdown.notify ? new Date() : null,
      },
    });

    if (scored.eligible && scored.breakdown.notify) {
      await prisma.notification.create({
        data: {
          userId: driver.userId,
          eventType: "job.matched",
          title: "بار جدید برای شما",
          body: `بار ${job.number} با ناوگان شما منطبق است. جزئیات را ببینید و قبول یا رد کنید.`,
          payload: { jobId, score: scored.score, kind: "job.matched" },
        },
      });
    }
    results.push(scored);
  }
  return results;
}
