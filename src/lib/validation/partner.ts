import { z } from "zod";

export const partnerShipmentSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "شماره فاکتور لازم است"),
  brandName: z.string().trim().min(2, "نام برند را بنویسید"),
  storeName: z.string().trim().min(2, "نام فروشگاه را بنویسید"),
  cargoType: z.string().trim().min(2, "نوع بار را بنویسید"),
  cartonCount: z.number().int().positive("تعداد کارتن باید بیشتر از صفر باشد"),
  cargoAmount: z.number().nonnegative("مبلغ فاکتور معتبر نیست"),
  province: z.string().trim().min(2, "استان را بنویسید"),
  county: z.string().trim().optional(),
  city: z.string().trim().min(2, "شهر مقصد را بنویسید"),
  warehouseName: z.string().trim().optional(),
  receivedAt: z.string().optional(),
  promisedDeliveryAt: z.string().optional(),
  shipAt: z.string().min(4, "تاریخ ارسال را مشخص کنید"),
  notes: z.string().optional(),
});

export const partnerAccountSchema = z.object({
  tradeName: z.string().trim().min(2),
  phone: z.string().trim().min(10, "موبایل لازم است"),
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  username: z.string().trim().min(3),
  password: z.string().min(10),
});

export const partnerPasswordSchema = z.object({
  password: z.string().min(10),
});

export const partnerAssignSchema = z.object({
  driverId: z.string().uuid(),
  freightAmount: z.number().positive(),
  driverLocation: z.string().trim().optional(),
});

export const partnerLocationSchema = z.object({
  driverLocation: z.string().trim().min(2, "لوکیشن راننده را بنویسید"),
});

export const partnerProfileSchema = z.object({
  tradeName: z.string().trim().min(2, "نام طرف قرارداد را بنویسید"),
  phone: z.string().trim().refine((value) => value.length === 0 || value.length >= 10, "موبایل معتبر نیست"),
  firstName: z.string().trim().min(1, "نام رابط را بنویسید"),
  lastName: z.string().trim().min(1, "نام خانوادگی را بنویسید"),
  addressLine: z.string().trim(),
  city: z.string().trim(),
  province: z.string().trim(),
}).superRefine((value, ctx) => {
  const started = Boolean(value.addressLine || value.city || value.province);
  if (!started) return;
  if (value.addressLine.length < 2) ctx.addIssue({ code: "custom", path: ["addressLine"], message: "آدرس را بنویسید" });
  if (value.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "شهر را بنویسید" });
  if (value.province.length < 2) ctx.addIssue({ code: "custom", path: ["province"], message: "استان را بنویسید" });
});
