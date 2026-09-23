import { z } from "zod";

export const podSchema = z.object({
  receiverName: z.string().min(1),
  receiverIdNumber: z.string().optional(),
  notes: z.string().optional(),
  damageNotes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  signatureStorageKey: z.string().optional(),
  deliveredQuantities: z.array(z.object({ shipmentItemId: z.string().uuid(), quantity: z.number().nonnegative() })),
});

export const jobStatusSchema = z.object({
  status: z.string(),
  note: z.string().optional(),
});
