import { describe, expect, it } from "vitest";
import { coordsForCity } from "./city-coords";
import { etaMinutesFor, remainingRoadKm, roadDistanceKm, roadFactor, routeWaypoints } from "./route";

describe("road distance", () => {
  const route = routeWaypoints("تهران", "آمل");
  const factor = roadFactor("تهران", "آمل");

  it("is a realistic road length for Tehran to Amol", () => {
    const km = roadDistanceKm(route, factor);
    expect(km).toBeGreaterThan(150);
    expect(km).toBeLessThan(230);
  });

  it("keeps almost the whole distance while the truck is still near Tehran", () => {
    const total = roadDistanceKm(route, factor);
    const left = remainingRoadKm(route, coordsForCity("تهران")!, factor);
    expect(left).toBeGreaterThan(total * 0.95);
  });

  it("is zero at the destination and derives a sensible ETA", () => {
    expect(remainingRoadKm(route, coordsForCity("آمل")!, factor)).toBeLessThan(2);
    expect(etaMinutesFor(0)).toBe(0);
    expect(etaMinutesFor(110, 55)).toBe(120);
    expect(etaMinutesFor(110, 0)).toBe(120);
  });
});
