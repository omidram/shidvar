import { prisma } from "@/server/db";
import { nextNumber } from "@/server/numbering";
import { runDriverMatching } from "@/server/domains/matching/run-driver-matching";
import { CITY_COORDS } from "@/lib/geo/city-coords";

async function warehouseForCity(companyId: string, city: string, line1?: string | null) {
  const existing = await prisma.warehouse.findFirst({
    where: { companyId, deletedAt: null, address: { city } },
    include: { address: true },
  });
  if (existing) return existing;

  const area = await prisma.geographicArea.findFirst({
    where: { type: "CITY", OR: [{ nameFa: city }, { nameEn: city }] },
  });
  const coords = CITY_COORDS[city];
  const address = await prisma.address.create({
    data: {
      companyId,
      line1: line1 || `بارگیری / تحویل در ${city}`,
      city,
      region: area?.nameFa ?? city,
      countryCode: "IR",
      geographicAreaId: area?.id,
      latitude: coords?.lat,
      longitude: coords?.lng,
    },
  });
  const code = `${city.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  return prisma.warehouse.create({
    data: {
      companyId,
      code,
      name: `${city}`,
      addressId: address.id,
    },
    include: { address: true },
  });
}

async function offerToVipDriver(jobId: string, jobNumber: string, driverId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true } });
  if (!driver) return;
  const breakdown = { vip: true, notify: true };
  await prisma.driverMatch.upsert({
    where: { jobId_driverId: { jobId, driverId } },
    create: { jobId, driverId, score: 100, breakdown, eligible: true, notifiedAt: new Date() },
    update: { score: 100, breakdown, eligible: true, notifiedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      userId: driver.userId,
      eventType: "job.matched",
      title: "بار VIP مخصوص شما",
      body: `بار ${jobNumber} فقط برای شما اعلام شده است. جزئیات را ببینید و قبول یا رد کنید.`,
      payload: { jobId, kind: "job.matched", vip: true },
    },
  });
}

export async function redispatchOpenJob(requestId: string) {
  const request = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: { orders: { include: { jobs: true } } },
  });
  const job = request?.orders.flatMap((o) => o.jobs).find((j) => ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING"].includes(j.status) && !j.assignedDriverId);
  if (!request || !job) return null;
  await prisma.driverMatch.updateMany({ where: { jobId: job.id }, data: { eligible: false } });
  if (request.dispatchMode === "VIP" && request.vipDriverId) {
    await offerToVipDriver(job.id, job.number, request.vipDriverId);
  } else {
    await runDriverMatching(job.id);
  }
  return job;
}

export async function dispatchCargoToDrivers(requestId: string) {
  const request = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: { items: true, company: true, orders: { include: { jobs: true } } },
  });
  if (!request) return null;
  if (request.orders.some((o) => o.jobs.length)) return request.orders[0];

  const originCity = request.originCity ?? "تهران";
  const destinationCity = request.destinationCity ?? "آمل";
  const pickup = await warehouseForCity(request.companyId, originCity, request.originLine1);
  const delivery = await warehouseForCity(request.companyId, destinationCity, request.destinationLine1);

  const weight = request.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const token = request.pickupNotes?.split("|")[0]?.trim();
  const allowed = ["VAN", "LIGHT_TRUCK", "TRUCK", "HEAVY_TRUCK", "TRAILER", "CONTAINER", "REFRIGERATED", "TANKER", "FLATBED"];
  const vehicle = token && allowed.includes(token) ? token : weight >= 10 ? "HEAVY_TRUCK" : "TRUCK";

  const order = await prisma.order.create({
    data: {
      number: await nextNumber("ORD"),
      requestId: request.id,
      requesterCompanyId: request.companyId,
      supplierCompanyId: request.companyId,
      status: "AWAITING_TRANSPORT",
      currencyCode: request.currencyCode,
      merchandiseTotal: request.budgetAmount ?? 0,
      items: {
        create: request.items.map((item) => ({
          requestItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitCode: item.unitCode,
          unitPrice: 0,
          lineTotal: 0,
        })),
      },
    },
  });

  const job = await prisma.transportationJob.create({
    data: {
      number: await nextNumber("JOB"),
      orderId: order.id,
      status: "MATCHING",
      pickupWarehouseId: pickup.id,
      deliveryWarehouseId: delivery.id,
      cargoWeight: weight,
      cargoUnit: request.items[0]?.unitCode ?? "carton",
      requiredVehicleType: ["VAN", "LIGHT_TRUCK", "TRUCK", "HEAVY_TRUCK", "TRAILER", "CONTAINER", "REFRIGERATED", "TANKER", "FLATBED"].includes(vehicle)
        ? (vehicle as never)
        : "TRUCK",
      deliveryDeadline: request.requestedDeliveryDate,
      currencyCode: request.currencyCode,
      compensationAmount: request.budgetAmount,
    },
  });

  await prisma.procurementRequest.update({
    where: { id: request.id },
    data: { status: "TRANSPORT_PENDING", destinationWarehouseId: delivery.id, version: { increment: 1 } },
  });

  if (request.dispatchMode === "VIP" && request.vipDriverId) {
    await offerToVipDriver(job.id, job.number, request.vipDriverId);
  } else {
    await runDriverMatching(job.id);
  }
  await prisma.transportationJob.update({
    where: { id: job.id, status: "MATCHING" },
    data: { status: "OFFERED_TO_DRIVERS", version: { increment: 1 } },
  });

  return { order, job };
}
