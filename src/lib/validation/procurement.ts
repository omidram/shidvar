import { z } from "zod";

export const requestItemSchema = z.object({
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  minQuantity: z.number().positive().optional(),
  maxQuantity: z.number().positive().optional(),
  unitCode: z.string().min(1),
  qualityNotes: z.string().optional(),
  packagingNotes: z.string().optional(),
});

export const createRequestSchema = z.object({
  originCity: z.string().min(2),
  destinationCity: z.string().min(2),
  originLine1: z.string().optional(),
  destinationLine1: z.string().optional(),
  destinationWarehouseId: z.string().uuid().optional(),
  requestedDeliveryDate: z.string(),
  budgetAmount: z.number().nonnegative().optional(),
  currencyCode: z.string().default("IRR"),
  notes: z.string().optional(),
  qualityNotes: z.string().optional(),
  packagingNotes: z.string().optional(),
  pickupNotes: z.string().optional(),
  requiredVehicleType: z.string().optional(),
  requiredCertifications: z.array(z.string()).optional(),
  items: z.array(requestItemSchema).min(1),
});

export const offerSchema = z.object({
  items: z
    .array(
      z.object({
        requestItemId: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
  pickupDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  validHours: z.number().positive().optional(),
});
