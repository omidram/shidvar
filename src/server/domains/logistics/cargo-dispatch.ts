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

  await runDriverMatching(job.id);
  await prisma.transportationJob.update({
    where: { id: job.id, status: "MATCHING" },
    data: { status: "OFFERED_TO_DRIVERS", version: { increment: 1 } },
  });

  return { order, job };
}
