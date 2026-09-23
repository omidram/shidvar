import { describe, expect, it } from "vitest";
import { DEFAULT_SUPPLIER_WEIGHTS } from "./weights";
import { scoreSupplier } from "./supplier-score";

const request = {
  items: [{ productId: "rice", categoryId: "food", quantity: 20, minQuantity: 18 }],
  city: "Tehran",
  region: "Tehran",
  areaIds: ["tehran"],
  requiredCertifications: ["ISO22000"],
  budgetAmount: 1000,
  requestedDeliveryDate: new Date("2026-09-01"),
};

const goodSupplier = {
  approved: true,
  suspended: false,
  products: [{ productId: "rice", categoryId: "food", indicativePrice: 900 }],
  capacityByProduct: { rice: 50 },
  capacityByCategory: { food: 50 },
  cities: ["Tehran"],
  regions: ["Tehran"],
  areaIds: ["tehran"],
  certifications: ["ISO22000"],
  ratingAvg: 4.8,
  fulfillmentRate: 0.96,
  onTimeRate: 0.94,
  openOrderCount: 2,
  promisedDeliveryDate: new Date("2026-08-30"),
};

describe("supplier matching", () => {
  it("scores an approved compatible supplier", () => {
    const result = scoreSupplier(request, goodSupplier, DEFAULT_SUPPLIER_WEIGHTS);
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThan(70);
    expect(result.breakdown.notify).toBe(1);
  });

  it("filters unapproved suppliers", () => {
    const result = scoreSupplier(request, { ...goodSupplier, approved: false }, DEFAULT_SUPPLIER_WEIGHTS);
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("not_approved");
  });

  it("filters product mismatch", () => {
    const result = scoreSupplier(
      request,
      { ...goodSupplier, products: [{ productId: "oil", categoryId: "other" }], capacityByProduct: {}, capacityByCategory: {} },
      DEFAULT_SUPPLIER_WEIGHTS,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("product_mismatch");
  });

  it("changes when weights change", () => {
    const highGeo = scoreSupplier(request, goodSupplier, {
      ...DEFAULT_SUPPLIER_WEIGHTS,
      geographicCompatibility: 80,
      productCompatibility: 1,
    });
    const lowGeo = scoreSupplier(
      { ...request, city: "Shiraz", areaIds: ["shiraz"] },
      goodSupplier,
      { ...DEFAULT_SUPPLIER_WEIGHTS, geographicCompatibility: 80, productCompatibility: 1 },
    );
    expect(highGeo.score).toBeGreaterThan(lowGeo.score);
  });
});
