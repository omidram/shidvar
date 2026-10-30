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
  currencyCode: z.string().optional().transform(() => "IRR"),
  notes: z.string().optional(),
  qualityNotes: z.string().optional(),
  packagingNotes: z.string().optional(),
  pickupNotes: z.string().optional(),
  requiredVehicleType: z.string().optional(),
  requiredCertifications: z.array(z.string()).optional(),
  items: z.array(requestItemSchema).min(1),
  dispatchMode: z.enum(["NORMAL", "VIP"]).default("NORMAL"),
  vipDriverId: z.string().uuid().optional(),
  needsWaybill: z.boolean().default(false),
  needsInsurance: z.boolean().default(false),
  loadType: z.enum(["FULL", "SHARED"]).default("FULL"),
}).refine((value) => value.dispatchMode !== "VIP" || Boolean(value.vipDriverId), {
  path: ["vipDriverId"],
  message: "برای اعلام VIP یک راننده انتخاب کنید",
});

export const announceRequestSchema = z.object({
  dispatchMode: z.enum(["NORMAL", "VIP"]),
  vipDriverId: z.string().uuid().optional(),
}).refine((value) => value.dispatchMode !== "VIP" || Boolean(value.vipDriverId), {
  path: ["vipDriverId"],
  message: "برای اعلام VIP یک راننده انتخاب کنید",
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
