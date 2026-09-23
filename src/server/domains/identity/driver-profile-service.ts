import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";

export async function getDriverProfile(actor: Actor, id: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, email: true, status: true, createdAt: true } },
      carrier: { include: { company: { select: { id: true, tradeName: true, legalName: true, phone: true, email: true } } } },
      vehicles: {
        include: {
          vehicle: {
            select: {
              id: true,
              plateNumber: true,
              vehicleType: true,
              status: true,
              brand: true,
              model: true,
              year: true,
              weightCapacity: true,
              volumeCapacity: true,
              insuranceExpiresAt: true,
              inspectionExpiresAt: true,
            },
          },
        },
      },
      assignedJobs: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          order: { include: { requesterCompany: true, request: { include: { items: true } } } },
          shipment: true,
        },
      },
    },
  });
  if (!driver) throw Errors.notFound();

  const isSelf = actor.driverProfile?.id === id;
  const companyIds = actor.memberships.map((m) => m.companyId);
  const relatedJob = actor.isPlatformStaff
    ? true
    : await prisma.transportationJob.findFirst({
        where: {
          assignedDriverId: id,
          order: {
            OR: [{ requesterCompanyId: { in: companyIds } }, { supplierCompanyId: { in: companyIds } }],
          },
        },
        select: { id: true },
      });
  if (!isSelf && !actor.isPlatformStaff && !relatedJob) throw Errors.notFound();

  const areas = await prisma.operatingArea.findMany({
    where: { ownerType: "DRIVER", ownerId: driver.id },
    include: { geographicArea: true },
  });
  const ratings = await prisma.rating.findMany({
    where: { targetType: "DRIVER", targetId: driver.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { rater: { select: { firstName: true, lastName: true } } },
  });

  return {
    id: driver.id,
    status: driver.status,
    licenseNumber: driver.licenseNumber,
    licenseType: driver.licenseType,
    licenseExpiresAt: driver.licenseExpiresAt,
    nationalIdMasked: driver.nationalIdMasked,
    ratingAvg: Number(driver.ratingAvg),
    ratingCount: driver.ratingCount,
    completedJobs: driver.completedJobs,
    openJobCount: driver.openJobCount,
    availableFrom: driver.availableFrom,
    availableTo: driver.availableTo,
    createdAt: driver.createdAt,
    user: driver.user,
    carrier: driver.carrier.company,
    areas: areas.map((area) => ({
      id: area.id,
      name: area.geographicArea.nameFa || area.geographicArea.nameEn,
      type: area.geographicArea.type,
    })),
    vehicles: driver.vehicles.map((row) => ({
      id: row.vehicle.id,
      isPrimary: row.isPrimary,
      plateNumber: row.vehicle.plateNumber,
      vehicleType: row.vehicle.vehicleType,
      status: row.vehicle.status,
      brand: row.vehicle.brand,
      model: row.vehicle.model,
      year: row.vehicle.year,
      weightCapacity: Number(row.vehicle.weightCapacity),
      volumeCapacity: row.vehicle.volumeCapacity != null ? Number(row.vehicle.volumeCapacity) : null,
      insuranceExpiresAt: row.vehicle.insuranceExpiresAt,
      inspectionExpiresAt: row.vehicle.inspectionExpiresAt,
    })),
    recentJobs: driver.assignedJobs.map((job) => ({
      id: job.id,
      number: job.number,
      status: job.status,
      originCity: job.order.request?.originCity ?? null,
      destinationCity: job.order.request?.destinationCity ?? null,
      cargoOwner: job.order.requesterCompany.tradeName,
      cargoItems: (job.order.request?.items ?? []).map((item) => `${item.name} ${Number(item.quantity)} ${item.unitCode}`),
      waybill: job.shipment?.trackingNumber ?? null,
      pickupAt: job.pickupAt,
      createdAt: job.createdAt,
    })),
    ratings: ratings.map((rating) => ({
      id: rating.id,
      overall: rating.overall,
      punctuality: rating.punctuality,
      communication: rating.communication,
      comment: rating.comment,
      rater: `${rating.rater.firstName} ${rating.rater.lastName}`.trim(),
      createdAt: rating.createdAt,
    })),
  };
}
