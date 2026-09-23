import { prisma } from "@/server/db";
import { scoreSupplier } from "@/server/matching/supplier-score";
import { DEFAULT_SUPPLIER_WEIGHTS, type SupplierWeights } from "@/server/matching/weights";
import { getRule } from "@/server/settings/rules";

export async function runSupplierMatching(requestId: string) {
  const request = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: {
      items: true,
      requirements: true,
      company: { include: { stores: { include: { address: true } }, warehouses: { include: { address: true } } } },
    },
  });
  if (!request) return [];

  const dest =
    request.company.warehouses.find((w) => w.id === request.destinationWarehouseId)?.address ??
    request.company.stores.find((s) => s.id === request.storeId)?.address;

  const weights = await getRule<SupplierWeights>("matching.supplier.weights", DEFAULT_SUPPLIER_WEIGHTS);
  const minScore = await getRule<number>("matching.minScoreToNotify", 40);
  const requiredCerts = request.requirements.filter((r) => r.kind === "CERTIFICATION").map((r) => r.value);

  const suppliers = await prisma.supplierProfile.findMany({
    include: {
      company: { include: { warehouses: { include: { address: true } } } },
      products: true,
      capacities: true,
      certifications: true,
    },
  });

  const requestAreas = await prisma.operatingArea.findMany({
    where: { ownerType: "REQUEST", ownerId: requestId },
  });

  const results = [];
  for (const supplier of suppliers) {
    const areas = await prisma.operatingArea.findMany({
      where: { ownerType: "SUPPLIER", ownerId: supplier.companyId },
    });
    const cities = supplier.company.warehouses.map((w) => w.address.city);
    const regions = supplier.company.warehouses.map((w) => w.address.region);
    const scored = scoreSupplier(
      {
        items: request.items.map((item) => ({
          productId: item.productId,
          categoryId: item.categoryId,
          quantity: Number(item.quantity),
          minQuantity: Number(item.minQuantity),
        })),
        city: dest?.city,
        region: dest?.region,
        areaIds: requestAreas.map((a) => a.geographicAreaId),
        requiredCertifications: requiredCerts,
        budgetAmount: request.budgetAmount ? Number(request.budgetAmount) : null,
        requestedDeliveryDate: request.requestedDeliveryDate,
      },
      {
        approved: supplier.status === "APPROVED" && supplier.company.status === "APPROVED",
        suspended: supplier.status === "SUSPENDED" || supplier.company.status === "SUSPENDED",
        products: supplier.products.map((p) => ({
          productId: p.productId,
          categoryId: p.categoryId,
          indicativePrice: p.indicativePrice ? Number(p.indicativePrice) : null,
        })),
        capacityByProduct: Object.fromEntries(
          supplier.products.flatMap((product) => {
            if (!product.productId) return [];
            const cap = supplier.capacities
              .filter((c) => c.supplierProductId === product.id)
              .reduce((sum, c) => sum + Number(c.quantity), 0);
            return [[product.productId, cap]] as Array<[string, number]>;
          }),
        ),
        capacityByCategory: Object.fromEntries(
          supplier.products.flatMap((product) => {
            if (!product.categoryId) return [];
            const cap = supplier.capacities
              .filter((c) => c.supplierProductId === product.id)
              .reduce((sum, c) => sum + Number(c.quantity), 0);
            return [[product.categoryId, cap]] as Array<[string, number]>;
          }),
        ),
        cities,
        regions,
        areaIds: areas.map((a) => a.geographicAreaId),
        certifications: supplier.certifications.map((c) => c.type),
        ratingAvg: Number(supplier.ratingAvg),
        fulfillmentRate: Number(supplier.fulfillmentRate),
        onTimeRate: Number(supplier.onTimeRate),
        openOrderCount: supplier.openOrderCount,
      },
      weights,
      minScore,
    );

    await prisma.supplierMatch.upsert({
      where: { requestId_supplierCompanyId: { requestId, supplierCompanyId: supplier.companyId } },
      create: {
        requestId,
        supplierCompanyId: supplier.companyId,
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
      const members = await prisma.membership.findMany({
        where: { companyId: supplier.companyId, status: "ACTIVE" },
      });
      for (const member of members) {
        await prisma.notification.create({
          data: {
            userId: member.userId,
            eventType: "supplier.matched",
            title: "درخواست منطبق",
            body: `درخواست ${request.number} با کاتالوگ شما هم‌خوان است.`,
            payload: { requestId, score: scored.score, kind: "supplier.matched" },
          },
        });
      }
    }
    results.push(scored);
  }
  return results;
}
