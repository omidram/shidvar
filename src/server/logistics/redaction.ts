import { detailsReleased } from "@/server/state-machines/transitions";
import type { TransportJobStatus } from "@prisma/client";

export type JobAddress = {
  city: string;
  region: string;
  line1: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function toDriverJobDto(input: {
  id: string;
  number: string;
  status: TransportJobStatus;
  cargoWeight: number;
  cargoUnit: string;
  requiredVehicleType?: string | null;
  compensationAmount?: number | string | null;
  pickupAt?: Date | null;
  deliveryDeadline?: Date | null;
  estimatedDistanceKm?: number | null;
  pickup?: JobAddress | null;
  delivery?: JobAddress | null;
  assignedToViewer: boolean;
  privileged?: boolean;
}) {
  const released = Boolean(input.privileged) || (detailsReleased(input.status) && input.assignedToViewer);
  return {
    id: input.id,
    number: input.number,
    status: input.status,
    cargoWeight: input.cargoWeight,
    cargoUnit: input.cargoUnit,
    requiredVehicleType: input.requiredVehicleType,
    compensationAmount: input.compensationAmount,
    pickupAt: input.pickupAt,
    deliveryDeadline: input.deliveryDeadline,
    estimatedDistanceKm: input.estimatedDistanceKm,
    detailsReleased: released,
    pickup: released
      ? input.pickup
      : input.pickup
        ? { city: input.pickup.city, region: input.pickup.region, line1: null, contactName: null, contactPhone: null }
        : null,
    delivery: released
      ? input.delivery
      : input.delivery
        ? { city: input.delivery.city, region: input.delivery.region, line1: null, contactName: null, contactPhone: null }
        : null,
  };
}
