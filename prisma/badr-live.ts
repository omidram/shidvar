import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient, RequestStatus, TransportJobStatus } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { dispatchCargoToDrivers } from "../src/server/domains/logistics/cargo-dispatch";
import { issueTransportDocuments } from "../src/server/domains/finance/invoice-service";
import { BADR_PRICE_BOOK, quotePrice, scaledBadrBook, type PriceBookInput } from "../src/server/domains/finance/price-book-service";

type Dispatch = {
  month: string;
  date: string;
  waybill: string;
  city: string;
  brand: string;
  store: string;
  qty: number;
  driver: string;
  warehouse: string;
  fare: number | null;
  notes: string;
  delivered: boolean;
};

const BRANDS: Array<{
  key: string;
  id: string;
  userId: string;
  legal: string;
  trade: string;
  email: string;
  phone: string;
  first: string;
  last: string;
  book: PriceBookInput;
}> = [
  {
    key: "بدر",
    id: "10000000-0000-4000-8000-0000000000b1",
    userId: "10000000-0000-4000-8000-0000000000c1",
    legal: "تولید مواد غذایی هوفرد",
    trade: "بدر (هوفرد)",
    email: "buyer@badr.local",
    phone: "02188001101",
    first: "حسین",
    last: "هوفرد",
    book: BADR_PRICE_BOOK,
  },
  {
    key: "سیرنگ",
    id: "10000000-0000-4000-8000-0000000000b2",
    userId: "10000000-0000-4000-8000-0000000000c2",
    legal: "اطلس پخش ساینا",
    trade: "سیرنگ (اطلس پخش ساینا)",
    email: "buyer@sirang.local",
    phone: "02188001102",
    first: "مریم",
    last: "ساینا",
    book: scaledBadrBook("دفترچه قیمت سیرنگ ۱۴۰۵", 0.95),
  },
  {
    key: "پانکو",
    id: "10000000-0000-4000-8000-0000000000b3",
    userId: "10000000-0000-4000-8000-0000000000c3",
    legal: "آفتاب تجارت نگین",
    trade: "پانکو (آفتاب تجارت نگین)",
    email: "buyer@panko.local",
    phone: "02188001103",
    first: "کامران",
    last: "نگین",
    book: scaledBadrBook("دفترچه قیمت پانکو ۱۴۰۵", 1.02),
  },
  {
    key: "چیکا",
    id: "10000000-0000-4000-8000-0000000000b4",
    userId: "10000000-0000-4000-8000-0000000000c4",
    legal: "نوین گستر چیکا",
    trade: "چیکا",
    email: "buyer@chika.local",
    phone: "02188001104",
    first: "سارا",
    last: "چیکا",
    book: scaledBadrBook("دفترچه قیمت چیکا ۱۴۰۵", 0.98),
  },
  {
    key: "کاتوس",
    id: "10000000-0000-4000-8000-0000000000b5",
    userId: "10000000-0000-4000-8000-0000000000c5",
    legal: "پاکساب شویان",
    trade: "کاتوس (پاکساب شویان)",
    email: "buyer@katus.local",
    phone: "02188001105",
    first: "رضا",
    last: "شویان",
    book: scaledBadrBook("دفترچه قیمت کاتوس ۱۴۰۵", 1.05),
  },
  {
    key: "ایران چاشنی",
    id: "10000000-0000-4000-8000-0000000000b6",
    userId: "10000000-0000-4000-8000-0000000000c6",
    legal: "شرکت ایران چاشنی",
    trade: "ایران چاشنی",
    email: "buyer@chashni.local",
    phone: "02188001106",
    first: "نرگس",
    last: "چاشنی",
    book: scaledBadrBook("دفترچه قیمت ایران چاشنی ۱۴۰۵", 1),
  },
  {
    key: "گل پخش آوند",
    id: "10000000-0000-4000-8000-0000000000b7",
    userId: "10000000-0000-4000-8000-0000000000c7",
    legal: "گل پخش آوند",
    trade: "گل پخش آوند",
    email: "buyer@avand.local",
    phone: "02188001107",
    first: "مهدی",
    last: "آوند",
    book: scaledBadrBook("دفترچه قیمت آوند ۱۴۰۵", 0.97),
  },
];

async function writeBook(prisma: PrismaClient, companyId: string, input: PriceBookInput) {
  const current = await prisma.priceBook.findFirst({ where: { companyId } });
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
}

export async function seedBadrAndDispatch(
  prisma: PrismaClient,
  ctx: { adminId: string; foodId: string; requesterRoleId: string; zarCompanyId: string },
) {
  const maxFrom = async (model: "order" | "transportationJob" | "invoice" | "shipment" | "procurementRequest") => {
    const row = await (prisma[model] as { findFirst: (args: object) => Promise<{ number?: string; trackingNumber?: string } | null> }).findFirst({
      orderBy: model === "shipment" ? { trackingNumber: "desc" } : { number: "desc" },
      select: model === "shipment" ? { trackingNumber: true } : { number: true },
    });
    const raw = model === "shipment" ? row?.trackingNumber : row?.number;
    const n = Number(String(raw ?? "").split("-").pop());
    return Number.isFinite(n) ? n : 0;
  };
  const floor = Math.max(
    500,
    await maxFrom("order"),
    await maxFrom("transportationJob"),
    await maxFrom("invoice"),
    await maxFrom("shipment"),
    await maxFrom("procurementRequest"),
  );
  for (const key of ["PR-2026", "ORD-2026", "JOB-2026", "SHP-2026", "INV-2026"]) {
    const row = await prisma.numberSequence.findUnique({ where: { key } });
    if (!row || row.lastValue < floor) {
      await prisma.numberSequence.upsert({ where: { key }, create: { key, lastValue: floor }, update: { lastValue: floor } });
    }
  }
  const passwordHash = await hashPassword("DevStore!2026");
  const companies = new Map<string, { id: string; userId: string }>();

  for (const brand of BRANDS) {
    await prisma.company.upsert({
      where: { id: brand.id },
      create: {
        id: brand.id,
        type: "REQUESTER",
        status: "APPROVED",
        legalName: brand.legal,
        tradeName: brand.trade,
        phone: brand.phone,
        email: brand.email,
        verifiedAt: new Date(),
        verifiedById: ctx.adminId,
      },
      update: { tradeName: brand.trade, legalName: brand.legal, status: "APPROVED", phone: brand.phone },
    });
    const user = await prisma.user.upsert({
      where: { email: brand.email },
      create: {
        id: brand.userId,
        email: brand.email,
        phone: `0912${brand.phone.slice(-7)}`,
        passwordHash,
        firstName: brand.first,
        lastName: brand.last,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      update: { passwordHash, firstName: brand.first, lastName: brand.last, status: "ACTIVE" },
    });
    await prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: brand.id } },
      create: { userId: user.id, companyId: brand.id, isOwner: true },
      update: { isOwner: true, status: "ACTIVE" },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: ctx.requesterRoleId, companyId: brand.id } });
    await writeBook(prisma, brand.id, brand.book);
    companies.set(brand.key, { id: brand.id, userId: user.id });
  }

  await writeBook(prisma, ctx.zarCompanyId, scaledBadrBook("دفترچه قیمت زر ماکارون ۱۴۰۵", 1.08));

  const others = await prisma.company.findMany({ where: { type: "REQUESTER" } });
  for (const company of others) {
    const exists = await prisma.priceBook.findFirst({ where: { companyId: company.id } });
    if (!exists) await writeBook(prisma, company.id, scaledBadrBook(`دفترچه قیمت ${company.tradeName}`, 1));
  }

  const drivers = await prisma.driverProfile.findMany({
    where: { status: "APPROVED" },
    orderBy: { completedJobs: "desc" },
  });
  const dispatches = JSON.parse(readFileSync(join(process.cwd(), "prisma/demo-dispatches.json"), "utf8")) as Dispatch[];

  for (const [index, row] of dispatches.entries()) {
    const company = companies.get(row.brand);
    if (!company) continue;
    const number = `PR-1405-${String(index + 1).padStart(4, "0")}`;
    const existing = await prisma.procurementRequest.findUnique({ where: { number } });
    if (existing) continue;
    const quote = await quotePrice(company.id, row.city, Number(row.qty));
    const budget = row.fare && row.fare > 0 ? row.fare : quote.amount ?? 2500000;
    const origin = row.warehouse && row.warehouse !== "شورآباد" ? row.warehouse : "تهران";
    const originLine = row.warehouse ? `انبار ${row.warehouse}` : "انبار شورآباد";
    const destLine = row.store || `تحویل فروشگاه در ${row.city}`;
    const request = await prisma.procurementRequest.create({
      data: {
        number,
        companyId: company.id,
        createdById: company.userId,
        status: "MATCHING",
        currencyCode: "IRR",
        budgetAmount: budget,
        requestedDeliveryDate: new Date("2026-08-20"),
        originCity: origin === "شورآباد" ? "تهران" : origin,
        destinationCity: row.city,
        originLine1: originLine,
        destinationLine1: destLine,
        pickupNotes: "TRUCK",
        notes: [row.driver && `راننده عملیاتی قبلی: ${row.driver}`, row.notes, row.waybill && `بارنامه دستی: ${row.waybill}`]
          .filter(Boolean)
          .join(" · "),
        publishedAt: new Date(),
        items: {
          create: [
            {
              categoryId: ctx.foodId,
              name: `محصولات ${row.brand}`,
              quantity: row.qty,
              minQuantity: row.qty,
              maxQuantity: row.qty,
              unitCode: "carton",
            },
          ],
        },
      },
    });
    const dispatched = await dispatchCargoToDrivers(request.id);
    const job = dispatched && "job" in dispatched ? dispatched.job : null;
    if (!job) continue;
    const driver = drivers[index % Math.max(drivers.length, 1)];
    if (!driver) continue;
    const done = Boolean(row.delivered);
    await prisma.transportationJob.update({
      where: { id: job.id },
      data: {
        assignedDriverId: driver.id,
        status: (done ? "DELIVERED" : "DRIVER_ASSIGNED") as TransportJobStatus,
        detailsReleasedAt: new Date(),
        compensationAmount: budget,
        version: { increment: 1 },
      },
    });
    await prisma.driverApplication.upsert({
      where: { jobId_driverId: { jobId: job.id, driverId: driver.id } },
      create: { jobId: job.id, driverId: driver.id, status: "CONFIRMED" },
      update: { status: "CONFIRMED" },
    });
    const order = await prisma.order.findFirstOrThrow({ where: { requestId: request.id }, include: { items: true } });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: done ? "COMPLETED" : "IN_FULFILLMENT", transportTotal: budget },
    });
    await prisma.procurementRequest.update({
      where: { id: request.id },
      data: { status: (done ? "COMPLETED" : "TRANSPORT_ASSIGNED") as RequestStatus, version: { increment: 1 } },
    });
    if (done) {
      const shipment = await prisma.shipment.findUnique({ where: { jobId: job.id } });
      if (!shipment) {
        await prisma.shipment.create({
          data: {
            trackingNumber: row.waybill || number.replace("PR", "SHP"),
            jobId: job.id,
            status: "DELIVERED",
            items: {
              create: order.items.map((item) => ({
                requestItemId: item.requestItemId,
                requestedQuantity: item.quantity,
                remainingQuantity: 0,
                deliveredQuantity: item.quantity,
                unitCode: item.unitCode,
              })),
            },
          },
        });
      }
      try {
        await issueTransportDocuments(order.id, job.id);
      } catch {
        /* invoice number may already exist from a prior seed */
      }
    }
  }

}
