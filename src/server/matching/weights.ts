export type SupplierWeightKey =
  | "productCompatibility"
  | "capacityCompatibility"
  | "geographicCompatibility"
  | "certificationCompatibility"
  | "priceScore"
  | "ratingScore"
  | "reliabilityScore"
  | "deliveryScore"
  | "workloadScore"
  | "verificationScore";

export type SupplierWeights = Record<SupplierWeightKey, number>;

export const DEFAULT_SUPPLIER_WEIGHTS: SupplierWeights = {
  productCompatibility: 20,
  capacityCompatibility: 15,
  geographicCompatibility: 15,
  certificationCompatibility: 10,
  priceScore: 10,
  ratingScore: 8,
  reliabilityScore: 8,
  deliveryScore: 7,
  workloadScore: 4,
  verificationScore: 3,
};

export type DriverWeightKey =
  | "vehicleFit"
  | "capacityFit"
  | "pickupDistance"
  | "areaFit"
  | "ratingScore"
  | "reliabilityScore"
  | "availability"
  | "equipmentFit"
  | "workloadScore"
  | "verificationScore";

export type DriverWeights = Record<DriverWeightKey, number>;

export const DEFAULT_DRIVER_WEIGHTS: DriverWeights = {
  vehicleFit: 18,
  capacityFit: 16,
  pickupDistance: 14,
  areaFit: 12,
  ratingScore: 10,
  reliabilityScore: 10,
  availability: 8,
  equipmentFit: 5,
  workloadScore: 4,
  verificationScore: 3,
};

export function normalizeScore(components: Record<string, number>, weights: Record<string, number>) {
  let weighted = 0;
  let total = 0;
  for (const key of Object.keys(weights)) {
    const weight = weights[key] ?? 0;
    const value = clamp01(components[key] ?? 0);
    weighted += weight * value;
    total += weight;
  }
  if (total <= 0) return 0;
  return Math.round((100 * weighted) / total * 100) / 100;
}

export function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
