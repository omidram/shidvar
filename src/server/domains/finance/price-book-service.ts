import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { provinceOf } from "@/lib/geo/iran-provinces";

export type PriceBookLineInput = {
  zoneName: string;
  provinces: string[];
  minQuantity: number;
  maxQuantity?: number | null;
  rateType: "PER_UNIT" | "SERVICE";
  unitPrice?: number | null;
  sortOrder?: number;
};

export type PriceBookInput = {
  name: string;
  status?: "DRAFT" | "ACTIVE";
  validFrom?: string | null;
  validTo?: string | null;
  currencyCode?: string;
  unitCode?: string;
  channels?: string[];
  terms?: string | null;
  settlementDays?: number | null;
  stopAfterUnpaidDays?: number | null;
  serviceAmount?: number | null;
  lines: PriceBookLineInput[];
};

function serializeBook(book: {
  id: string;
  companyId: string;
  name: string;
  status: string;
  validFrom: Date | null;
  validTo: Date | null;
  currencyCode: string;
  unitCode: string;
  channels: unknown;
  terms: string | null;
  settlementDays: number | null;
  stopAfterUnpaidDays: number | null;
  serviceAmount: unknown;
  updatedAt: Date;
  lines: Array<{
    id: string;
    zoneName: string;
    provinces: unknown;
    minQuantity: number;
    maxQuantity: number | null;
    rateType: string;
    unitPrice: unknown;
    sortOrder: number;
  }>;
}) {
  return {
    id: book.id,
    companyId: book.companyId,
    name: book.name,
    status: book.status,
    validFrom: book.validFrom,
    validTo: book.validTo,
    currencyCode: book.currencyCode,
    unitCode: book.unitCode,
    channels: Array.isArray(book.channels) ? book.channels : [],
    terms: book.terms,
    settlementDays: book.settlementDays,
    stopAfterUnpaidDays: book.stopAfterUnpaidDays,
    serviceAmount: book.serviceAmount != null ? Number(book.serviceAmount) : null,
    updatedAt: book.updatedAt,
    lines: book.lines
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => ({
        id: line.id,
        zoneName: line.zoneName,
        provinces: Array.isArray(line.provinces) ? (line.provinces as string[]) : [],
        minQuantity: line.minQuantity,
        maxQuantity: line.maxQuantity,
        rateType: line.rateType,
        unitPrice: line.unitPrice != null ? Number(line.unitPrice) : null,
        sortOrder: line.sortOrder,
      })),
  };
}

export async function ensurePriceBook(companyId: string, name = "دفترچه قیمت حمل") {
  const existing = await prisma.priceBook.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  return prisma.priceBook.create({
    data: { companyId, name, status: "DRAFT" },
  });
}

export async function getPriceBookForCompany(actor: Actor, companyId: string) {
  const owns = actor.memberships.some((m) => m.companyId === companyId);
  if (!actor.isPlatformStaff && !owns) throw Errors.notFound();
  if (actor.isPlatformStaff) assertPermission(actor, "companies.read");
  const book = await prisma.priceBook.findFirst({
    where: { companyId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  if (!book) return null;
  return serializeBook(book);
}

export async function getOwnPriceBook(actor: Actor) {
  const companyId = actor.memberships.find((m) => m.companyType === "REQUESTER")?.companyId;
  if (!companyId && !actor.isPlatformStaff) throw Errors.forbidden();
  if (!companyId) throw Errors.notFound();
  return getPriceBookForCompany(actor, companyId);
}

export async function upsertPriceBook(actor: Actor, companyId: string, input: PriceBookInput) {
  assertPermission(actor, "companies.update");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.type === "PLATFORM") throw Errors.notFound();
  const current = await prisma.priceBook.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  const data = {
    name: input.name,
    status: input.status ?? "ACTIVE",
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    currencyCode: input.currencyCode ?? "IRR",
    unitCode: input.unitCode ?? "carton",
    channels: input.channels ?? [],
    terms: input.terms ?? null,
    settlementDays: input.settlementDays ?? null,
    stopAfterUnpaidDays: input.stopAfterUnpaidDays ?? null,
    serviceAmount: input.serviceAmount ?? null,
  };
  const book = current
    ? await prisma.priceBook.update({ where: { id: current.id }, data })
    : await prisma.priceBook.create({ data: { companyId, ...data } });
  await prisma.priceBookLine.deleteMany({ where: { priceBookId: book.id } });
  if (input.lines.length) {
    await prisma.priceBookLine.createMany({
      data: input.lines.map((line, index) => ({
        priceBookId: book.id,
        zoneName: line.zoneName,
        provinces: line.provinces,
        minQuantity: line.minQuantity,
        maxQuantity: line.maxQuantity ?? null,
        rateType: line.rateType,
        unitPrice: line.unitPrice ?? null,
        sortOrder: line.sortOrder ?? index,
      })),
    });
  }
  const fresh = await prisma.priceBook.findUniqueOrThrow({ where: { id: book.id }, include: { lines: true } });
  const applied = data.status === "ACTIVE" ? await applyPriceBookToOpenLoads(companyId) : { requests: 0, jobs: 0 };
  return { ...serializeBook(fresh), applied };
}

export async function applyPriceBookToOpenLoads(companyId: string) {
  const requests = await prisma.procurementRequest.findMany({
    where: {
      companyId,
      status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PUBLISHED", "MATCHING", "TRANSPORT_PENDING"] },
    },
    include: { items: true, orders: { include: { invoices: true, jobs: true } } },
  });
  let requestCount = 0;
  let jobCount = 0;
  for (const request of requests) {
    if (!request.destinationCity) continue;
    const qty = request.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const quote = await quotePrice(companyId, request.destinationCity, qty);
    if (quote.amount == null) continue;
    await prisma.procurementRequest.update({ where: { id: request.id }, data: { budgetAmount: quote.amount } });
    requestCount += 1;
    for (const order of request.orders) {
      if (["CREATED", "CONFIRMED", "AWAITING_TRANSPORT", "IN_FULFILLMENT"].includes(order.status)) {
        await prisma.order.update({ where: { id: order.id }, data: { transportTotal: quote.amount } });
      }
      const issued = order.invoices.some((invoice) => invoice.status === "ISSUED" || invoice.status === "PAID");
      for (const job of order.jobs) {
        if (issued) continue;
        if (["DELIVERED", "COMPLETED", "CANCELLED"].includes(job.status)) continue;
        await prisma.transportationJob.update({ where: { id: job.id }, data: { compensationAmount: quote.amount } });
        jobCount += 1;
      }
    }
  }
  return { requests: requestCount, jobs: jobCount };
}

export async function quotePrice(companyId: string, destinationCity: string, quantity: number) {
  const book = await prisma.priceBook.findFirst({
    where: { companyId, status: "ACTIVE" },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  if (!book) return { matched: false, amount: null as number | null, label: "دفترچه قیمت فعال نیست", zoneName: null as string | null, rateType: null as string | null, unitPrice: null as number | null };
  const province = provinceOf(destinationCity);
  const lines = book.lines.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const line = lines.find((item) => {
    const provinces = Array.isArray(item.provinces) ? (item.provinces as string[]) : [];
    const zoneHit = province ? provinces.includes(province) : item.zoneName.includes(destinationCity);
    const minOk = quantity >= item.minQuantity;
    const maxOk = item.maxQuantity == null || quantity <= item.maxQuantity;
    return zoneHit && minOk && maxOk;
  });
  if (!line) {
    return { matched: false, amount: null, label: province ? `نرخ برای استان ${province} تعریف نشده` : `استان شهر ${destinationCity} مشخص نیست`, zoneName: null, rateType: null, unitPrice: null };
  }
  if (line.rateType === "SERVICE") {
    const amount = line.unitPrice != null ? Number(line.unitPrice) : book.serviceAmount != null ? Number(book.serviceAmount) : null;
    return { matched: true, amount, label: "سرویسی (زیر حداقل کارتن)", zoneName: line.zoneName, rateType: "SERVICE", unitPrice: amount };
  }
  const unit = line.unitPrice != null ? Number(line.unitPrice) : 0;
  return {
    matched: true,
    amount: unit * quantity,
    label: `${line.zoneName} · ${quantity} کارتن × ${unit.toLocaleString("fa-IR")}`,
    zoneName: line.zoneName,
    rateType: "PER_UNIT",
    unitPrice: unit,
  };
}

export const BADR_PRICE_BOOK: PriceBookInput = {
  name: "هزینه حمل محصولات بدر ۱۴۰۵",
  status: "ACTIVE",
  validFrom: "2026-05-04",
  validTo: "2026-09-05",
  currencyCode: "IRR",
  unitCode: "carton",
  channels: ["اتکا", "هایپرمی", "هایپراستار", "افق کوروش", "جانبو", "فستیوال"],
  settlementDays: 10,
  stopAfterUnpaidDays: 3,
  serviceAmount: 2500000,
  terms: [
    "هزینه‌ها به جز فروشگاه‌های راه آبی است.",
    "ارسال فاکتور زیر ۱۵ کارتن انجام نمی‌شود؛ در صورت ارسال، هزینه سرویسی لحاظ می‌شود.",
    "ارسال در روزهای تعطیل انجام نمی‌شود.",
    "فاکتورهای افق کوروش، جانبو و هایپراستار به‌خاطر سرویس‌لول، ۴۸ ساعت کاری پس از ورود به انبار تحویل فروشگاه می‌شوند. تأخیر به عهده باربری است.",
    "تسویه هر ۱۰ روز یک‌بار. عدم پرداخت تا ۳ روز کاری، ارسال متوقف می‌شود.",
    "مبالغ از ۱۴۰۵/۰۲/۱۴ تا ۱۴۰۵/۰۶/۱۴ معتبر است.",
  ].join("\n"),
  lines: [
    ...zoneLines("تهران و البرز", ["تهران", "البرز"], 540000, 510000),
    ...zoneLines("قزوین، قم، اصفهان، مازندران، گیلان و همدان", ["قزوین", "قم", "اصفهان", "مازندران", "گیلان", "همدان"], 510000, 500000),
    ...zoneLines("اردبیل، آذربایجان شرقی و غربی، گلستان، مرکزی، سمنان و زنجان", ["اردبیل", "آذربایجان شرقی", "آذربایجان غربی", "گلستان", "مرکزی", "سمنان", "زنجان"], 560000, 550000),
    ...zoneLines("چهارمحال، خراسان شمالی و رضوی، لرستان، کردستان، ایلام، یزد و کرمانشاه", ["چهارمحال و بختیاری", "خراسان شمالی", "خراسان رضوی", "لرستان", "کردستان", "ایلام", "یزد", "کرمانشاه"], 640000, 630000),
    ...zoneLines("سیستان، هرمزگان، فارس، خراسان جنوبی، خوزستان، کهگیلویه، کرمان و بوشهر", ["سیستان و بلوچستان", "هرمزگان", "فارس", "خراسان جنوبی", "خوزستان", "کهگیلویه و بویراحمد", "کرمان", "بوشهر"], 850000, 840000),
  ],
};

function zoneLines(zoneName: string, provinces: string[], mid: number, high: number): PriceBookLineInput[] {
  return [
    { zoneName, provinces, minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null, sortOrder: 0 },
    { zoneName, provinces, minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: mid, sortOrder: 1 },
    { zoneName, provinces, minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: high, sortOrder: 2 },
  ];
}

export function scaledBadrBook(name: string, factor: number): PriceBookInput {
  return {
    ...BADR_PRICE_BOOK,
    name,
    lines: BADR_PRICE_BOOK.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice != null ? Math.round(line.unitPrice * factor) : null,
    })),
    serviceAmount: Math.round((BADR_PRICE_BOOK.serviceAmount ?? 2500000) * factor),
  };
}
