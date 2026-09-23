import { clamp01, haversineKm, normalizeScore, type DriverWeights } from "@/server/matching/weights";

export type JobMatchInput = {
  cargoWeight: number;
  requiredVehicleType?: string | null;
  requiredEquipment: string[];
  pickupAreaIds: string[];
  pickupCity?: string | null;
  pickupPoint?: { lat: number; lng: number } | null;
  pickupAt?: Date | null;
};

export type DriverMatchInput = {
  approved: boolean;
  suspended: boolean;
  vehicleTypes: string[];
  maxWeight: number;
  equipment: string[];
  areaIds: string[];
  cities: string[];
  location?: { lat: number; lng: number } | null;
  ratingAvg: number;
  onTimeRate: number;
  completedJobs: number;
  openJobCount: number;
  available: boolean;
};

export function scoreDriver(job: JobMatchInput, driver: DriverMatchInput, weights: DriverWeights, minScore = 40) {
  const reasons: string[] = [];
  if (!driver.approved) reasons.push("not_approved");
  if (driver.suspended) reasons.push("suspended");
  if (!driver.available) reasons.push("unavailable");

  const GENERAL_RANK = ["VAN", "LIGHT_TRUCK", "TRUCK", "HEAVY_TRUCK", "TRAILER"];
  const required = job.requiredVehicleType;
  const exact = !required || driver.vehicleTypes.includes(required);
  const needRank = required ? GENERAL_RANK.indexOf(required) : -1;
  const upgraded =
    needRank >= 0 && driver.vehicleTypes.some((type) => GENERAL_RANK.indexOf(type) >= needRank);
  const vehicleFit = exact || upgraded ? 1 : 0;
  if (vehicleFit === 0) reasons.push("vehicle_mismatch");

  const capacityFit = driver.maxWeight >= job.cargoWeight ? 1 : driver.maxWeight > 0 ? clamp01(driver.maxWeight / job.cargoWeight) : 0;
  if (capacityFit < 1) reasons.push("capacity_short");

  let pickupDistance = 0.5;
  if (job.pickupPoint && driver.location) {
    const km = haversineKm(job.pickupPoint, driver.location);
    pickupDistance = clamp01(1 - km / 400);
  }

  let areaFit = 0;
  if (job.pickupAreaIds.some((id) => driver.areaIds.includes(id))) areaFit = 0.8;
  if (job.pickupCity && driver.cities.includes(job.pickupCity)) areaFit = 1;
  if (areaFit === 0) reasons.push("area_mismatch");

  const equipmentFit = job.requiredEquipment.length
    ? job.requiredEquipment.filter((e) => driver.equipment.includes(e)).length / job.requiredEquipment.length
    : 1;

  const breakdown = {
    vehicleFit,
    capacityFit,
    pickupDistance,
    areaFit,
    ratingScore: clamp01(driver.ratingAvg / 5),
    reliabilityScore: clamp01(driver.onTimeRate),
    availability: driver.available ? 1 : 0,
    equipmentFit,
    workloadScore: clamp01(1 - driver.openJobCount / 5),
    verificationScore: driver.approved ? 1 : 0,
  };

  const eligible = reasons.length === 0;
  const score = eligible ? normalizeScore(breakdown, weights) : 0;
  return {
    eligible,
    reasons,
    score,
    breakdown: { ...breakdown, notify: eligible && score >= minScore ? 1 : 0 },
  };
}
