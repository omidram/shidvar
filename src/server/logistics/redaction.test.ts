import { describe, expect, it } from "vitest";
import { toDriverJobDto } from "./redaction";

const base = {
  id: "job-1",
  number: "JOB-1",
  cargoWeight: 20,
  cargoUnit: "ton",
  requiredVehicleType: "HEAVY_TRUCK" as const,
  compensationAmount: 100,
  pickupAt: new Date("2026-09-01"),
  deliveryDeadline: new Date("2026-09-02"),
  estimatedDistanceKm: 80,
  pickup: { city: "Tehran", region: "Tehran", line1: "12 Warehouse Rd", contactName: "Sara", contactPhone: "0912" },
  delivery: { city: "Karaj", region: "Alborz", line1: "DC 4", contactName: "Omid", contactPhone: "021" },
  assignedToViewer: true,
};

describe("driver information release", () => {
  it("redacts street and contacts before confirmation", () => {
    const dto = toDriverJobDto({ ...base, status: "OFFERED_TO_DRIVERS" });
    expect(dto.detailsReleased).toBe(false);
    expect(dto.pickup?.line1).toBeNull();
    expect(dto.pickup?.city).toBe("Tehran");
    expect(dto.pickup?.contactPhone).toBeNull();
  });

  it("releases full details after supplier confirmation for the assigned driver", () => {
    const dto = toDriverJobDto({ ...base, status: "SUPPLIER_CONFIRMED" });
    expect(dto.detailsReleased).toBe(true);
    expect(dto.pickup?.line1).toBe("12 Warehouse Rd");
    expect(dto.pickup?.contactPhone).toBe("0912");
  });

  it("releases full details to a privileged party before driver confirmation", () => {
    const dto = toDriverJobDto({ ...base, status: "OFFERED_TO_DRIVERS", privileged: true });
    expect(dto.detailsReleased).toBe(true);
    expect(dto.pickup?.line1).toBe("12 Warehouse Rd");
  });

  it("does not release details to an unassigned driver even after confirm", () => {
    const dto = toDriverJobDto({ ...base, status: "IN_TRANSIT", assignedToViewer: false });
    expect(dto.detailsReleased).toBe(false);
    expect(dto.delivery?.line1).toBeNull();
  });
});
