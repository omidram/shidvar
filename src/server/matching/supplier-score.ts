import { clamp01, normalizeScore, type SupplierWeights } from "@/server/matching/weights";

export type RequestMatchInput = {
  items: Array<{
    productId?: string | null;
    categoryId?: string | null;
    quantity: number;
    minQuantity: number;
  }>;
  city?: string | null;
  region?: string | null;
  areaIds: string[];
  requiredCertifications: string[];
  budgetAmount?: number | null;
  requestedDeliveryDate: Date;
};

export type SupplierMatchInput = {
  approved: boolean;
  suspended: boolean;
  products: Array<{ productId?: string | null; categoryId?: string | null; indicativePrice?: number | null }>;
  capacityByProduct: Record<string, number>;
  capacityByCategory: Record<string, number>;
  cities: string[];
  regions: string[];
  areaIds: string[];
  certifications: string[];
  ratingAvg: number;
  fulfillmentRate: number;
  onTimeRate: number;
  openOrderCount: number;
  promisedDeliveryDate?: Date | null;
};

export type MatchResult = {
  eligible: boolean;
  reasons: string[];
  score: number;
  breakdown: Record<string, number>;
};

export function scoreSupplier(
  request: RequestMatchInput,
  supplier: SupplierMatchInput,
  weights: SupplierWeights,
  minScoreToNotify = 40,
): MatchResult {
  const reasons: string[] = [];
  if (supplier.suspended) reasons.push("suspended");
  if (!supplier.approved) reasons.push("not_approved");

  let productCompatibility = 0;
  let capacityCompatibility = 0;
  for (const item of request.items) {
    const exact = supplier.products.some((p) => item.productId && p.productId === item.productId);
    const category = supplier.products.some((p) => item.categoryId && p.categoryId === item.categoryId);
    const itemProduct = exact ? 1 : category ? 0.7 : 0;
    productCompatibility += itemProduct;
    const cap =
      (item.productId ? supplier.capacityByProduct[item.productId] : undefined) ??
      (item.categoryId ? supplier.capacityByCategory[item.categoryId] : undefined) ??
      0;
    capacityCompatibility += cap >= item.minQuantity ? 1 : cap > 0 ? clamp01(cap / item.minQuantity) : 0;
  }
  productCompatibility = request.items.length ? productCompatibility / request.items.length : 0;
  capacityCompatibility = request.items.length ? capacityCompatibility / request.items.length : 0;
  if (productCompatibility === 0) reasons.push("product_mismatch");

  let geographicCompatibility = 0;
  if (request.areaIds.some((id) => supplier.areaIds.includes(id))) geographicCompatibility = 0.8;
  if (request.city && supplier.cities.includes(request.city)) geographicCompatibility = 1;
  else if (request.region && supplier.regions.includes(request.region)) {
    geographicCompatibility = Math.max(geographicCompatibility, 0.6);
  }
  if (geographicCompatibility === 0) reasons.push("area_mismatch");

  const certNeed = request.requiredCertifications;
  const certificationCompatibility = certNeed.length
    ? certNeed.filter((c) => supplier.certifications.includes(c)).length / certNeed.length
    : 1;
  if (certificationCompatibility < 1) reasons.push("certification_gap");

  const prices = supplier.products
    .map((p) => p.indicativePrice)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  let priceScore = 0.5;
  if (request.budgetAmount && avgPrice) {
    priceScore = clamp01(request.budgetAmount / avgPrice);
  }

  const ratingScore = clamp01(supplier.ratingAvg / 5);
  const reliabilityScore = clamp01((supplier.fulfillmentRate + supplier.onTimeRate) / 2);
  let deliveryScore = 0.5;
  if (supplier.promisedDeliveryDate) {
    const delta = supplier.promisedDeliveryDate.getTime() - request.requestedDeliveryDate.getTime();
    deliveryScore = delta <= 0 ? 1 : clamp01(1 - delta / (1000 * 60 * 60 * 24 * 14));
  }
  const workloadScore = clamp01(1 - supplier.openOrderCount / 20);
  const verificationScore = supplier.approved ? 1 : 0;

  const breakdown = {
    productCompatibility,
    capacityCompatibility,
    geographicCompatibility,
    certificationCompatibility,
    priceScore,
    ratingScore,
    reliabilityScore,
    deliveryScore,
    workloadScore,
    verificationScore,
  };

  const eligible = reasons.length === 0;
  const score = eligible ? normalizeScore(breakdown, weights) : 0;
  return {
    eligible,
    reasons,
    score,
    breakdown: { ...breakdown, minScoreToNotify, notify: eligible && score >= minScoreToNotify ? 1 : 0 },
  };
}
