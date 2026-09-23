import type { PrismaClient, RequestStatus, TransportJobStatus } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { dispatchCargoToDrivers } from "../src/server/domains/logistics/cargo-dispatch";
import { issueTransportDocuments } from "../src/server/domains/finance/invoice-service";
import { runDriverMatching } from "../src/server/domains/matching/run-driver-matching";
import { seedBadrAndDispatch } from "./badr-live";
import { seedExtraDemo } from "./seed-extra-demo";

type SeedCtx = {
  adminId: string;
  platformId: string;
  foodId: string;
  requesterRoleId: string;
  driverRoleId: string;
  zarCompanyId: string;
  zarUserId: string;
  aliDriverId: string;
  aliUserId: string;
};

async function upsertUser(
  prisma: PrismaClient,
  opts: {
    id: string;
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    roleId: string;
    companyId: string;
  },
) {
  const passwordHash = await hashPassword(opts.password);
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    create: {
      id: opts.id,
      email: opts.email,
      phone: opts.phone,
      passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
    update: { passwordHash, status: "ACTIVE", firstName: opts.firstName, lastName: opts.lastName },
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: opts.companyId } },
    create: { userId: user.id, companyId: opts.companyId, isOwner: true },
    update: { status: "ACTIVE", isOwner: true },
  });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: opts.roleId, companyId: opts.companyId } });
  return user;
}

async function notify(prisma: PrismaClient, userId: string, title: string, body: string, eventType: string) {
  const exists = await prisma.notification.findFirst({ where: { userId, title } });
  if (exists) return;
  await prisma.notification.create({ data: { userId, title, body, eventType, channel: "IN_APP" } });
}

export async function seedLiveData(prisma: PrismaClient, ctx: SeedCtx) {
  const iran = await prisma.geographicArea.findFirstOrThrow({ where: { type: "COUNTRY", code: "IR" } });
  async function city(code: string, nameEn: string, nameFa: string, regionCode: string, regionFa: string) {
    const region = await prisma.geographicArea.upsert({
      where: { type_code: { type: "REGION", code: regionCode } },
      create: { type: "REGION", code: regionCode, nameEn, nameFa: regionFa, parentId: iran.id },
      update: {},
    });
    return prisma.geographicArea.upsert({
      where: { type_code: { type: "CITY", code } },
      create: { type: "CITY", code, nameEn, nameFa, parentId: region.id },
      update: {},
    });
  }
  const tehran = await prisma.geographicArea.findFirstOrThrow({ where: { type: "CITY", code: "THR" } });
  const karaj = await prisma.geographicArea.findFirstOrThrow({ where: { type: "CITY", code: "KRJ" } });
  const amol = await prisma.geographicArea.findFirstOrThrow({ where: { type: "CITY", code: "AML" } });
  const isfahan = await city("ESF", "Isfahan", "اصفهان", "ESF", "اصفهان");
  const mashhad = await city("MHD", "Mashhad", "مشهد", "RKH", "خراسان رضوی");
  const shiraz = await city("SHZ", "Shiraz", "شیراز", "FRS", "فارس");
  const tabriz = await city("TBZ", "Tabriz", "تبریز", "EAZ", "آذربایجان شرقی");
  const ahvaz = await city("AHW", "Ahvaz", "اهواز", "KHU", "خوزستان");
  const qom = await city("QOM", "Qom", "قم", "QOM", "قم");
  const allCities = [tehran, karaj, amol, isfahan, mashhad, shiraz, tabriz, ahvaz, qom];

  const dairy = await prisma.productCategory.upsert({
    where: { code: "DAIRY" },
    create: { code: "DAIRY", nameEn: "Dairy", nameFa: "لبنیات", parentId: ctx.foodId },
    update: {},
  });
  const beverage = await prisma.productCategory.upsert({
    where: { code: "BEV" },
    create: { code: "BEV", nameEn: "Beverage", nameFa: "نوشیدنی", parentId: ctx.foodId },
    update: {},
  });

  async function product(sku: string, nameEn: string, nameFa: string, categoryId: string, unit: string) {
    return prisma.product.upsert({
      where: { sku },
      create: { sku, nameEn, nameFa, categoryId, defaultUnit: unit },
      update: { nameFa, defaultUnit: unit },
    });
  }
  const rice = await prisma.product.findUniqueOrThrow({ where: { sku: "RICE-001" } });
  const oil = await prisma.product.findUniqueOrThrow({ where: { sku: "OIL-001" } });
  const sugar = await prisma.product.findUniqueOrThrow({ where: { sku: "SUGAR-001" } });
  const flour = await prisma.product.findUniqueOrThrow({ where: { sku: "FLOUR-001" } });
  const macaroni = await prisma.product.findUniqueOrThrow({ where: { sku: "MAC-001" } });
  const milk = await product("MILK-001", "Milk", "شیر پاکتی", dairy.id, "carton");
  const yogurt = await product("YOG-001", "Yogurt", "ماست دبه‌ای", dairy.id, "carton");
  const cheese = await product("CHS-001", "Cheese", "پنیر صبحانه", dairy.id, "box");
  const juice = await product("JUC-001", "Juice", "آبمیوه طبیعی", beverage.id, "carton");
  const water = await product("WTR-001", "Water", "آب معدنی بسته‌ای", beverage.id, "pallet");
  const tea = await product("TEA-001", "Tea", "چای ایرانی", ctx.foodId, "carton");

  async function cargoCompany(id: string, legal: string, trade: string, phone: string, status: "APPROVED" | "UNDER_REVIEW" | "PENDING", user: { id: string; email: string; phone: string; first: string; last: string }) {
    const company = await prisma.company.upsert({
      where: { id },
      create: {
        id,
        type: "REQUESTER",
        status,
        legalName: legal,
        tradeName: trade,
        phone,
        verifiedAt: status === "APPROVED" ? new Date() : null,
        verifiedById: status === "APPROVED" ? ctx.adminId : null,
      },
      update: { status, tradeName: trade, legalName: legal, phone },
    });
    const owner = await upsertUser(prisma, {
      id: user.id,
      email: user.email,
      phone: user.phone,
      password: "DevStore!2026",
      firstName: user.first,
      lastName: user.last,
      roleId: ctx.requesterRoleId,
      companyId: company.id,
    });
    return { company, owner };
  }

  const golestan = await cargoCompany("00000000-0000-0000-0000-000000000005", "Golestan Distribution", "شرکت پخش گلستان", "02144001001", "APPROVED", {
    id: "00000000-0000-0000-0000-000000000021",
    email: "maryam@golestan.local",
    phone: "09122110001",
    first: "مریم",
    last: "احمدی",
  });
  const kalleh = await cargoCompany("00000000-0000-0000-0000-000000000006", "Kalleh Food Industries", "صنایع غذایی کاله", "02144001002", "APPROVED", {
    id: "00000000-0000-0000-0000-000000000022",
    email: "saeed@kalleh.local",
    phone: "09122110002",
    first: "سعید",
    last: "نوری",
  });
  const pegah = await cargoCompany("00000000-0000-0000-0000-000000000007", "Pegah Dairy", "لبنیات پگاه", "02144001003", "APPROVED", {
    id: "00000000-0000-0000-0000-000000000023",
    email: "fatemeh@pegah.local",
    phone: "09122110003",
    first: "فاطمه",
    last: "رضوی",
  });
  await cargoCompany("00000000-0000-0000-0000-000000000008", "Mihan Distribution", "پخش میهن", "02144001004", "UNDER_REVIEW", {
    id: "00000000-0000-0000-0000-000000000024",
    email: "pending@mihan.local",
    phone: "09122110004",
    first: "نیما",
    last: "صالحی",
  });
  await cargoCompany("00000000-0000-0000-0000-000000000009", "Behrouz Foods", "پخش بهروز", "02144001005", "PENDING", {
    id: "00000000-0000-0000-0000-000000000025",
    email: "pending@behrouz.local",
    phone: "09122110005",
    first: "الهام",
    last: "کاویانی",
  });

  async function fleet(opts: {
    companyId: string;
    userId: string;
    email: string;
    phone: string;
    first: string;
    last: string;
    trade: string;
    plate: string;
    vehicle: "VAN" | "TRUCK" | "HEAVY_TRUCK" | "REFRIGERATED" | "TRAILER";
    status: "APPROVED" | "UNDER_REVIEW" | "REJECTED";
    cities: Array<{ id: string }>;
    rating: number;
    jobs: number;
    lat: number;
    lng: number;
    license: string;
  }) {
    const company = await prisma.company.upsert({
      where: { id: opts.companyId },
      create: {
        id: opts.companyId,
        type: "CARRIER",
        status: opts.status === "REJECTED" ? "APPROVED" : opts.status,
        legalName: opts.trade,
        tradeName: opts.trade,
        verifiedAt: opts.status === "APPROVED" ? new Date() : null,
        verifiedById: opts.status === "APPROVED" ? ctx.adminId : null,
      },
      update: { tradeName: opts.trade },
    });
    await prisma.carrierProfile.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, status: opts.status === "REJECTED" ? "APPROVED" : opts.status, ratingAvg: opts.rating, onTimeRate: 0.9 },
      update: { status: opts.status === "REJECTED" ? "APPROVED" : opts.status },
    });
    const user = await upsertUser(prisma, {
      id: opts.userId,
      email: opts.email,
      phone: opts.phone,
      password: "DevDriver!2026",
      firstName: opts.first,
      lastName: opts.last,
      roleId: ctx.driverRoleId,
      companyId: company.id,
    });
    const driver = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        carrierCompanyId: company.id,
        status: opts.status,
        licenseNumber: opts.license,
        licenseType: "base-2",
        licenseExpiresAt: new Date("2029-06-01"),
        ratingAvg: opts.rating,
        completedJobs: opts.jobs,
        lastKnownLat: opts.lat,
        lastKnownLng: opts.lng,
      },
      update: { status: opts.status, ratingAvg: opts.rating, completedJobs: opts.jobs },
    });
    const vehicle = await prisma.vehicle.upsert({
      where: { companyId_plateNumber: { companyId: company.id, plateNumber: opts.plate } },
      create: {
        companyId: company.id,
        plateNumber: opts.plate,
        vehicleType: opts.vehicle,
        weightCapacity: opts.vehicle === "VAN" ? 1.5 : 40,
        volumeCapacity: 50,
        status: "AVAILABLE",
        brand: "اسکانیا",
      },
      update: { vehicleType: opts.vehicle, status: "AVAILABLE" },
    });
    await prisma.driverVehicle.upsert({
      where: { driverId_vehicleId: { driverId: driver.id, vehicleId: vehicle.id } },
      create: { driverId: driver.id, vehicleId: vehicle.id, isPrimary: true },
      update: {},
    });
    await prisma.operatingArea.createMany({
      data: opts.cities.map((c) => ({ ownerType: "DRIVER" as const, ownerId: driver.id, geographicAreaId: c.id })),
      skipDuplicates: true,
    });
    return driver;
  }

  const javad = await fleet({
    companyId: "00000000-0000-0000-0000-000000000031",
    userId: "00000000-0000-0000-0000-000000000032",
    email: "javad.akbari@fleet.local",
    phone: "09123330001",
    first: "جواد",
    last: "اکبری",
    trade: "ناوگان اکبری",
    plate: "21-IRN-118",
    vehicle: "TRUCK",
    status: "APPROVED",
    cities: [tehran, isfahan, qom],
    rating: 4.6,
    jobs: 88,
    lat: 35.7,
    lng: 51.4,
    license: "22110033",
  });
  const mehdi = await fleet({
    companyId: "00000000-0000-0000-0000-000000000033",
    userId: "00000000-0000-0000-0000-000000000034",
    email: "mehdi.kazemi@fleet.local",
    phone: "09123330002",
    first: "مهدی",
    last: "کاظمی",
    trade: "ناوگان سرد کاظمی",
    plate: "44-IRN-902",
    vehicle: "REFRIGERATED",
    status: "APPROVED",
    cities: [tehran, mashhad, karaj],
    rating: 4.9,
    jobs: 210,
    lat: 35.72,
    lng: 51.41,
    license: "33445566",
  });
  const reza = await fleet({
    companyId: "00000000-0000-0000-0000-000000000035",
    userId: "00000000-0000-0000-0000-000000000036",
    email: "reza.shiri@fleet.local",
    phone: "09123330003",
    first: "رضا",
    last: "شیری",
    trade: "وانت شیری",
    plate: "55-IRN-441",
    vehicle: "VAN",
    status: "APPROVED",
    cities: [tehran, karaj],
    rating: 4.3,
    jobs: 41,
    lat: 35.75,
    lng: 51.38,
    license: "77889900",
  });
  const sara = await fleet({
    companyId: "00000000-0000-0000-0000-000000000037",
    userId: "00000000-0000-0000-0000-000000000038",
    email: "sara.ghasemi@fleet.local",
    phone: "09123330004",
    first: "سارا",
    last: "قاسمی",
    trade: "تریلی قاسمی",
    plate: "66-IRN-770",
    vehicle: "TRAILER",
    status: "APPROVED",
    cities: [tehran, shiraz, ahvaz],
    rating: 4.7,
    jobs: 132,
    lat: 35.68,
    lng: 51.42,
    license: "55667788",
  });
  await fleet({
    companyId: "00000000-0000-0000-0000-000000000039",
    userId: "00000000-0000-0000-0000-000000000040",
    email: "kamran.lotfi@fleet.local",
    phone: "09123330005",
    first: "کامران",
    last: "لطفی",
    trade: "ناوگان لطفی",
    plate: "77-IRN-010",
    vehicle: "TRUCK",
    status: "UNDER_REVIEW",
    cities: [tehran],
    rating: 0,
    jobs: 0,
    lat: 35.7,
    lng: 51.4,
    license: "11223344",
  });
  await fleet({
    companyId: "00000000-0000-0000-0000-000000000041",
    userId: "00000000-0000-0000-0000-000000000042",
    email: "peyman.yousefi@fleet.local",
    phone: "09123330006",
    first: "پیمان",
    last: "یوسفی",
    trade: "ناوگان یوسفی",
    plate: "88-IRN-303",
    vehicle: "TRUCK",
    status: "REJECTED",
    cities: [tehran],
    rating: 3.1,
    jobs: 12,
    lat: 35.7,
    lng: 51.4,
    license: "99887766",
  });

  await prisma.operatingArea.createMany({
    data: allCities.map((c) => ({ ownerType: "DRIVER" as const, ownerId: ctx.aliDriverId, geographicAreaId: c.id })),
    skipDuplicates: true,
  });

  async function cargo(opts: {
    number: string;
    companyId: string;
    userId: string;
    origin: string;
    dest: string;
    originLine: string;
    destLine: string;
    name: string;
    qty: number;
    unit: string;
    productId?: string;
    categoryId: string;
    budget: number;
    vehicle: string;
    assign?: { driverId: string; jobStatus: TransportJobStatus; requestStatus: RequestStatus; documents?: boolean };
  }) {
    const existing = await prisma.procurementRequest.findUnique({ where: { number: opts.number } });
    if (existing) {
      const order = await prisma.order.findFirst({ where: { requestId: existing.id }, include: { jobs: true } });
      if (order?.jobs[0] && !opts.assign) await runDriverMatching(order.jobs[0].id);
      return existing;
    }
    const request = await prisma.procurementRequest.create({
      data: {
        number: opts.number,
        companyId: opts.companyId,
        createdById: opts.userId,
        status: "MATCHING",
        currencyCode: "IRR",
        budgetAmount: opts.budget,
        requestedDeliveryDate: new Date("2026-09-08"),
        originCity: opts.origin,
        destinationCity: opts.dest,
        originLine1: opts.originLine,
        destinationLine1: opts.destLine,
        pickupNotes: opts.vehicle,
        publishedAt: new Date(),
        items: {
          create: [{
            productId: opts.productId,
            categoryId: opts.categoryId,
            name: opts.name,
            quantity: opts.qty,
            minQuantity: opts.qty,
            maxQuantity: opts.qty,
            unitCode: opts.unit,
          }],
        },
      },
    });
    const dispatched = await dispatchCargoToDrivers(request.id);
    const job = dispatched && "job" in dispatched ? dispatched.job : null;
    if (opts.assign && job) {
      await prisma.transportationJob.update({
        where: { id: job.id },
        data: {
          assignedDriverId: opts.assign.driverId,
          status: opts.assign.jobStatus,
          detailsReleasedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await prisma.driverApplication.upsert({
        where: { jobId_driverId: { jobId: job.id, driverId: opts.assign.driverId } },
        create: { jobId: job.id, driverId: opts.assign.driverId, status: "CONFIRMED" },
        update: { status: "CONFIRMED" },
      });
      const order = await prisma.order.findFirstOrThrow({ where: { requestId: request.id }, include: { items: true } });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: opts.assign.requestStatus === "COMPLETED" ? "COMPLETED" : "IN_FULFILLMENT" },
      });
      await prisma.procurementRequest.update({
        where: { id: request.id },
        data: { status: opts.assign.requestStatus, version: { increment: 1 } },
      });
      if (opts.assign.documents) {
        const shipment = await prisma.shipment.findUnique({ where: { jobId: job.id } });
        if (!shipment) {
          await prisma.shipment.create({
            data: {
              trackingNumber: opts.number.replace("PR", "SHP"),
              jobId: job.id,
              status: opts.assign.jobStatus,
              items: {
                create: order.items.map((item) => ({
                  requestItemId: item.requestItemId,
                  requestedQuantity: item.quantity,
                  remainingQuantity: item.quantity,
                  unitCode: item.unitCode,
                })),
              },
            },
          });
        }
        await issueTransportDocuments(order.id, job.id);
      }
    }
    return request;
  }

  await cargo({
    number: "PR-2026-000021",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "تهران",
    dest: "مشهد",
    originLine: "انبار غرب زر ماکارون",
    destLine: "مرکز پخش مشهد",
    name: "برنج پاکستانی کیسه‌ای",
    qty: 12,
    unit: "carton",
    productId: rice.id,
    categoryId: ctx.foodId,
    budget: 14500000,
    vehicle: "TRUCK",
  });
  await cargo({
    number: "PR-2026-000022",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "کرج",
    dest: "قم",
    originLine: "انبار کرج زر",
    destLine: "بازار قم",
    name: "روغن مایع حلبی",
    qty: 8,
    unit: "carton",
    productId: oil.id,
    categoryId: ctx.foodId,
    budget: 9200000,
    vehicle: "TRUCK",
  });
  await cargo({
    number: "PR-2026-000023",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "تهران",
    dest: "اصفهان",
    originLine: "انبار مرکزی زر",
    destLine: "مرکز پخش اصفهان",
    name: "آرد نول کیسه‌ای",
    qty: 20,
    unit: "carton",
    productId: flour.id,
    categoryId: ctx.foodId,
    budget: 16800000,
    vehicle: "TRUCK",
    assign: { driverId: javad.id, jobStatus: "IN_TRANSIT", requestStatus: "IN_TRANSIT", documents: true },
  });
  await cargo({
    number: "PR-2026-000024",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "تهران",
    dest: "شیراز",
    originLine: "انبار جنوب زر",
    destLine: "انبار شیراز",
    name: "شکر سفید کیسه‌ای",
    qty: 16,
    unit: "carton",
    productId: sugar.id,
    categoryId: ctx.foodId,
    budget: 12100000,
    vehicle: "TRAILER",
    assign: { driverId: sara.id, jobStatus: "DELIVERED", requestStatus: "DELIVERED", documents: true },
  });
  await cargo({
    number: "PR-2026-000025",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "آمل",
    dest: "تهران",
    originLine: "مرکز پخش آمل",
    destLine: "انبار برگشتی تهران",
    name: "ماکارونی کارتن ۲۵تایی",
    qty: 30,
    unit: "carton",
    productId: macaroni.id,
    categoryId: ctx.foodId,
    budget: 18900000,
    vehicle: "HEAVY_TRUCK",
    assign: { driverId: ctx.aliDriverId, jobStatus: "COMPLETED", requestStatus: "COMPLETED", documents: true },
  });
  await cargo({
    number: "PR-2026-000026",
    companyId: golestan.company.id,
    userId: golestan.owner.id,
    origin: "تهران",
    dest: "تبریز",
    originLine: "انبار گلستان جاده مخصوص",
    destLine: "مرکز پخش تبریز",
    name: "چای ایرانی گلستان",
    qty: 18,
    unit: "carton",
    productId: tea.id,
    categoryId: ctx.foodId,
    budget: 11000000,
    vehicle: "TRUCK",
  });
  await cargo({
    number: "PR-2026-000027",
    companyId: golestan.company.id,
    userId: golestan.owner.id,
    origin: "تهران",
    dest: "اهواز",
    originLine: "انبار گلستان",
    destLine: "مرکز پخش اهواز",
    name: "آبمیوه طبیعی",
    qty: 14,
    unit: "carton",
    productId: juice.id,
    categoryId: beverage.id,
    budget: 13400000,
    vehicle: "TRUCK",
    assign: { driverId: sara.id, jobStatus: "DRIVER_ASSIGNED", requestStatus: "TRANSPORT_ASSIGNED", documents: true },
  });
  await cargo({
    number: "PR-2026-000028",
    companyId: kalleh.company.id,
    userId: kalleh.owner.id,
    origin: "تهران",
    dest: "مشهد",
    originLine: "سردخانه کاله تهران",
    destLine: "سردخانه مشهد",
    name: "شیر پاکتی کاله",
    qty: 40,
    unit: "carton",
    productId: milk.id,
    categoryId: dairy.id,
    budget: 21000000,
    vehicle: "REFRIGERATED",
  });
  await cargo({
    number: "PR-2026-000029",
    companyId: kalleh.company.id,
    userId: kalleh.owner.id,
    origin: "کرج",
    dest: "تهران",
    originLine: "کارخانه کاله کرج",
    destLine: "هایپر تهرانپارس",
    name: "ماست دبه‌ای",
    qty: 22,
    unit: "carton",
    productId: yogurt.id,
    categoryId: dairy.id,
    budget: 9800000,
    vehicle: "REFRIGERATED",
    assign: { driverId: mehdi.id, jobStatus: "IN_TRANSIT", requestStatus: "IN_TRANSIT", documents: true },
  });
  await cargo({
    number: "PR-2026-000030",
    companyId: pegah.company.id,
    userId: pegah.owner.id,
    origin: "تهران",
    dest: "قم",
    originLine: "سردخانه پگاه",
    destLine: "مرکز پخش قم",
    name: "پنیر صبحانه پگاه",
    qty: 10,
    unit: "box",
    productId: cheese.id,
    categoryId: dairy.id,
    budget: 7600000,
    vehicle: "VAN",
  });
  await cargo({
    number: "PR-2026-000031",
    companyId: pegah.company.id,
    userId: pegah.owner.id,
    origin: "تهران",
    dest: "کرج",
    originLine: "انبار پگاه آزادی",
    destLine: "فروشگاه زنجیره‌ای کرج",
    name: "آب معدنی بسته‌ای",
    qty: 6,
    unit: "pallet",
    productId: water.id,
    categoryId: beverage.id,
    budget: 5400000,
    vehicle: "TRUCK",
    assign: { driverId: reza.id, jobStatus: "COMPLETED", requestStatus: "COMPLETED", documents: true },
  });
  await cargo({
    number: "PR-2026-000032",
    companyId: ctx.zarCompanyId,
    userId: ctx.zarUserId,
    origin: "تهران",
    dest: "آمل",
    originLine: "انبار شبانه زر",
    destLine: "مرکز پخش آمل ۲",
    name: "ماکارونی فوری کارتن ۱۲تایی",
    qty: 9,
    unit: "carton",
    productId: macaroni.id,
    categoryId: ctx.foodId,
    budget: 6700000,
    vehicle: "TRUCK",
  });

  const completedZar = await prisma.order.findFirst({ where: { request: { number: "PR-2026-000025" } } });
  if (completedZar) {
    const ratingExists = await prisma.rating.findFirst({ where: { orderId: completedZar.id } });
    if (!ratingExists) {
      await prisma.rating.create({
        data: {
          orderId: completedZar.id,
          raterUserId: ctx.zarUserId,
          targetType: "DRIVER",
          targetId: ctx.aliDriverId,
          overall: 5,
          reliability: 5,
          punctuality: 5,
          comment: "تحویل به‌موقع و سالم بود.",
        },
      });
    }
    const disputeExists = await prisma.dispute.findUnique({ where: { number: "DSP-2026-000001" } });
    if (!disputeExists) {
      await prisma.dispute.create({
        data: {
          number: "DSP-2026-000001",
          orderId: completedZar.id,
          reporterId: ctx.zarUserId,
          assigneeId: ctx.adminId,
          reason: "تأخیر جزئی در تخلیه",
          description: "بار سالم رسید اما تخلیه یک ساعت طول کشید. فقط برای ثبت عملیاتی باز شده.",
          status: "UNDER_REVIEW",
        },
      });
    }
  }

  const ticketExists = await prisma.supportTicket.findUnique({ where: { number: "TCK-2026-000001" } });
  if (!ticketExists) {
    await prisma.supportTicket.create({
      data: {
        number: "TCK-2026-000001",
        userId: ctx.zarUserId,
        category: "حمل",
        priority: "HIGH",
        status: "IN_PROGRESS",
        subject: "نیاز به راننده یخچال‌دار برای مسیر شمال",
        assignedToId: ctx.adminId,
        messages: { create: { authorId: ctx.zarUserId, body: "برای محموله لبنی هفته بعد راننده سردخانه کم داریم." } },
      },
    });
  }

  await notify(prisma, ctx.zarUserId, "راننده بار تهران به آمل را قبول کرد", "علی رضایی بار ماکارونی را قبول کرد و بارنامه صادر شد.", "job.accepted");
  await notify(prisma, ctx.zarUserId, "بار اصفهان در مسیر است", "جواد اکبری محموله آرد را بارگیری کرد.", "job.in_transit");
  await notify(prisma, ctx.aliUserId, "سه درخواست جدید در محدوده شما", "از تهران به آمل، مشهد و قم بارهای باز وجود دارد.", "job.offered");
  await notify(prisma, ctx.aliUserId, "کرایه مسیر برگشتی ثبت شد", "بار آمل به تهران تکمیل و فاکتور صادر شد.", "invoice.issued");
  await notify(prisma, ctx.adminId, "دو شرکت پخش در انتظار تأیید", "پخش میهن و پخش بهروز فرم ثبت‌نام فرستاده‌اند.", "company.review");
  await notify(prisma, ctx.adminId, "دو راننده در انتظار بررسی", "کامران لطفی و حسین محمدی مدارک را ارسال کرده‌اند.", "driver.review");
  await notify(prisma, golestan.owner.id, "درخواست تبریز برای رانندگان ارسال شد", "رانندگان تأییدشده محدوده تهران مطلع شدند.", "request.published");
  await notify(prisma, kalleh.owner.id, "راننده یخچال‌دار تخصیص یافت", "مهدی کاظمی بار ماست را قبول کرد.", "job.assigned");

  const audits = [
    { action: "request.published", entityType: "ProcurementRequest", entityId: "live-seed-pr" },
    { action: "job.accepted_by_driver", entityType: "TransportationJob", entityId: "live-seed-job" },
    { action: "invoice.issued", entityType: "Invoice", entityId: "live-seed-inv" },
    { action: "company.under_review", entityType: "Company", entityId: "00000000-0000-0000-0000-000000000008" },
  ];
  for (const row of audits) {
    const exists = await prisma.auditLog.findFirst({ where: { action: row.action, entityId: row.entityId } });
    if (!exists) {
      await prisma.auditLog.create({
        data: { actorType: "USER", actorId: ctx.adminId, actorRole: "SUPER_ADMIN", ...row },
      });
    }
  }

  for (const key of ["PR-2026", "ORD-2026", "JOB-2026", "SHP-2026", "INV-2026"]) {
    const row = await prisma.numberSequence.findUnique({ where: { key } });
    if (!row || row.lastValue < 40) {
      await prisma.numberSequence.upsert({ where: { key }, create: { key, lastValue: 40 }, update: { lastValue: 40 } });
    }
  }

  await seedBadrAndDispatch(prisma, {
    adminId: ctx.adminId,
    foodId: ctx.foodId,
    requesterRoleId: ctx.requesterRoleId,
    zarCompanyId: ctx.zarCompanyId,
  });
  await seedExtraDemo(prisma, {
    adminId: ctx.adminId,
    foodId: ctx.foodId,
    requesterRoleId: ctx.requesterRoleId,
    driverRoleId: ctx.driverRoleId,
  });

  const { ensureDemoTracking } = await import("../src/server/domains/logistics/tracking-service");
  await ensureDemoTracking();
  const { seedWalletDemo } = await import("../src/server/domains/finance/wallet-service");
  await seedWalletDemo(ctx.aliDriverId);
}
