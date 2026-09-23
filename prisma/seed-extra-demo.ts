import type { PrismaClient, RequestStatus, TransportJobStatus, VehicleType } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { dispatchCargoToDrivers } from "../src/server/domains/logistics/cargo-dispatch";
import { issueTransportDocuments } from "../src/server/domains/finance/invoice-service";

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

export async function seedExtraDemo(
  prisma: PrismaClient,
  ctx: { adminId: string; foodId: string; requesterRoleId: string; driverRoleId: string },
) {
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
  const rasht = await city("RAS", "Rasht", "رشت", "GIL", "گیلان");
  const yazd = await city("YZD", "Yazd", "یزد", "YZD", "یزد");
  const kerman = await city("KER", "Kerman", "کرمان", "KER", "کرمان");
  const babb = await city("BND", "Bandar Abbas", "بندرعباس", "HOR", "هرمزگان");
  const urmia = await city("URM", "Urmia", "ارومیه", "WAZ", "آذربایجان غربی");
  const sari = await city("SAR", "Sari", "ساری", "MZN", "مازندران");
  const arak = await city("ARK", "Arak", "اراک", "MKZ", "مرکزی");
  const hamedan = await city("HMD", "Hamedan", "همدان", "HMD", "همدان");
  const bushehr = await city("BUS", "Bushehr", "بوشهر", "BUS", "بوشهر");
  const extraCities = [tehran, karaj, rasht, yazd, kerman, babb, urmia, sari, arak, hamedan, bushehr];

  const canned = await prisma.productCategory.upsert({
    where: { code: "CANNED" },
    create: { code: "CANNED", nameEn: "Canned", nameFa: "کنسرو و رب", parentId: ctx.foodId },
    update: {},
  });
  const frozen = await prisma.productCategory.upsert({
    where: { code: "FROZEN" },
    create: { code: "FROZEN", nameEn: "Frozen", nameFa: "منجمد", parentId: ctx.foodId },
    update: {},
  });
  async function product(sku: string, nameEn: string, nameFa: string, categoryId: string, unit: string) {
    return prisma.product.upsert({
      where: { sku },
      create: { sku, nameEn, nameFa, categoryId, defaultUnit: unit },
      update: { nameFa, defaultUnit: unit },
    });
  }
  const paste = await product("PST-001", "Tomato paste", "رب گوجه فرنگی حلبی", canned.id, "carton");
  const beans = await product("BNS-001", "Canned beans", "کنسرو لوبیا", canned.id, "carton");
  const pickle = await product("PCK-001", "Pickles", "خیارشور شیشه‌ای", canned.id, "carton");
  const chicken = await product("CHK-001", "Frozen chicken", "مرغ منجمد", frozen.id, "carton");
  const veg = await product("VEG-001", "Frozen vegetables", "سبزیجات منجمد", frozen.id, "carton");
  const biscuit = await product("BSC-001", "Biscuits", "بیسکویت پذیرایی", ctx.foodId, "carton");
  const sauce = await product("SAU-001", "Sauce", "سس مایونز", ctx.foodId, "carton");

  async function cargoCompany(
    id: string,
    legal: string,
    trade: string,
    phone: string,
    user: { id: string; email: string; phone: string; first: string; last: string },
  ) {
    const company = await prisma.company.upsert({
      where: { id },
      create: {
        id,
        type: "REQUESTER",
        status: "APPROVED",
        legalName: legal,
        tradeName: trade,
        phone,
        verifiedAt: new Date(),
        verifiedById: ctx.adminId,
      },
      update: { status: "APPROVED", tradeName: trade, legalName: legal, phone },
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
    const existingWh = await prisma.warehouse.findUnique({ where: { companyId_code: { companyId: company.id, code: "DC-1" } } });
    if (!existingWh) {
      const address = await prisma.address.create({
        data: {
          companyId: company.id,
          line1: `انبار مرکزی ${trade}`,
          city: "تهران",
          region: "تهران",
          countryCode: "IR",
          latitude: 35.7,
          longitude: 51.4,
          geographicAreaId: tehran.id,
        },
      });
      await prisma.warehouse.create({
        data: { companyId: company.id, code: "DC-1", name: `مرکز پخش ${trade}`, addressId: address.id },
      });
    }
    return { company, owner };
  }

  const mahram = await cargoCompany("20000000-0000-4000-8000-0000000000a1", "Mahram Food Co", "صنایع غذایی مهرام", "02144002001", {
    id: "20000000-0000-4000-8000-0000000000b1",
    email: "buyer@mahram.local",
    phone: "09124001001",
    first: "شیرین",
    last: "مهرام",
  });
  const delpazir = await cargoCompany("20000000-0000-4000-8000-0000000000a2", "Delpazir Foods", "دلپذیر", "02144002002", {
    id: "20000000-0000-4000-8000-0000000000b2",
    email: "buyer@delpazir.local",
    phone: "09124001002",
    first: "کامبیز",
    last: "دلپذیر",
  });
  const yekoyek = await cargoCompany("20000000-0000-4000-8000-0000000000a3", "Yek O Yek", "یک‌و‌یک", "02144002003", {
    id: "20000000-0000-4000-8000-0000000000b3",
    email: "buyer@yekoyek.local",
    phone: "09124001003",
    first: "آزاده",
    last: "یزدی",
  });
  const shirin = await cargoCompany("20000000-0000-4000-8000-0000000000a4", "Shirin Asal", "شیرین‌عسل", "02144002004", {
    id: "20000000-0000-4000-8000-0000000000b4",
    email: "buyer@shirin-asal.local",
    phone: "09124001004",
    first: "بهروز",
    last: "عسلی",
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
    vehicle: VehicleType;
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
        status: "APPROVED",
        legalName: opts.trade,
        tradeName: opts.trade,
        verifiedAt: new Date(),
        verifiedById: ctx.adminId,
      },
      update: { tradeName: opts.trade, status: "APPROVED" },
    });
    await prisma.carrierProfile.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, status: "APPROVED", ratingAvg: opts.rating, onTimeRate: 0.92 },
      update: { status: "APPROVED", ratingAvg: opts.rating },
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
        status: "APPROVED",
        licenseNumber: opts.license,
        licenseType: "base-2",
        licenseExpiresAt: new Date("2030-01-01"),
        ratingAvg: opts.rating,
        completedJobs: opts.jobs,
        lastKnownLat: opts.lat,
        lastKnownLng: opts.lng,
      },
      update: { status: "APPROVED", ratingAvg: opts.rating, completedJobs: opts.jobs },
    });
    const vehicle = await prisma.vehicle.upsert({
      where: { companyId_plateNumber: { companyId: company.id, plateNumber: opts.plate } },
      create: {
        companyId: company.id,
        plateNumber: opts.plate,
        vehicleType: opts.vehicle,
        weightCapacity: opts.vehicle === "VAN" ? 1.5 : 24,
        volumeCapacity: 48,
        status: "AVAILABLE",
        brand: "ولوو",
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

  const navid = await fleet({
    companyId: "20000000-0000-4000-8000-0000000000c1",
    userId: "20000000-0000-4000-8000-0000000000d1",
    email: "navid.karimi@fleet.local",
    phone: "09125001001",
    first: "نوید",
    last: "کریمی",
    trade: "ناوگان شمال کریمی",
    plate: "12-IRN-801",
    vehicle: "REFRIGERATED",
    cities: [tehran, rasht, sari],
    rating: 4.7,
    jobs: 96,
    lat: 35.71,
    lng: 51.39,
    license: "44112200",
  });
  const farhad = await fleet({
    companyId: "20000000-0000-4000-8000-0000000000c2",
    userId: "20000000-0000-4000-8000-0000000000d2",
    email: "farhad.moradi@fleet.local",
    phone: "09125001002",
    first: "فرهاد",
    last: "مرادی",
    trade: "تریلی مرادی",
    plate: "22-IRN-612",
    vehicle: "TRAILER",
    cities: [tehran, yazd, kerman, babb],
    rating: 4.5,
    jobs: 154,
    lat: 35.69,
    lng: 51.43,
    license: "55223311",
  });
  const leila = await fleet({
    companyId: "20000000-0000-4000-8000-0000000000c3",
    userId: "20000000-0000-4000-8000-0000000000d3",
    email: "leila.abbasi@fleet.local",
    phone: "09125001003",
    first: "لیلا",
    last: "عباسی",
    trade: "وانت عباسی",
    plate: "33-IRN-219",
    vehicle: "VAN",
    cities: [tehran, karaj, arak, hamedan],
    rating: 4.4,
    jobs: 67,
    lat: 35.74,
    lng: 51.37,
    license: "66334422",
  });
  const hooman = await fleet({
    companyId: "20000000-0000-4000-8000-0000000000c4",
    userId: "20000000-0000-4000-8000-0000000000d4",
    email: "hooman.nouri@fleet.local",
    phone: "09125001004",
    first: "هومن",
    last: "نوری",
    trade: "ناوگان غرب نوری",
    plate: "48-IRN-430",
    vehicle: "TRUCK",
    cities: [tehran, urmia, hamedan, arak],
    rating: 4.8,
    jobs: 121,
    lat: 35.73,
    lng: 51.4,
    license: "77445533",
  });

  const aliUser = await prisma.user.findUnique({ where: { email: "ali.rezaei@fleet.local" } });
  const ali = aliUser ? await prisma.driverProfile.findUnique({ where: { userId: aliUser.id } }) : null;
  const mehdiUser = await prisma.user.findUnique({ where: { email: "mehdi.kazemi@fleet.local" } });
  const mehdi = mehdiUser ? await prisma.driverProfile.findUnique({ where: { userId: mehdiUser.id } }) : null;
  const chashniUser = await prisma.user.findUnique({ where: { email: "buyer@chashni.local" } });
  const chashniCo = await prisma.company.findFirst({ where: { tradeName: "ایران چاشنی" } });
  const kallehUser = await prisma.user.findUnique({ where: { email: "saeed@kalleh.local" } });
  const kallehCo = await prisma.company.findFirst({ where: { tradeName: "صنایع غذایی کاله" } });

  await prisma.operatingArea.createMany({
    data: extraCities.flatMap((c) =>
      [navid, farhad, leila, hooman, ali, mehdi].filter(Boolean).map((d) => ({
        ownerType: "DRIVER" as const,
        ownerId: d!.id,
        geographicAreaId: c.id,
      })),
    ),
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
    if (existing) return existing;
    const request = await prisma.procurementRequest.create({
      data: {
        number: opts.number,
        companyId: opts.companyId,
        createdById: opts.userId,
        status: "MATCHING",
        currencyCode: "IRR",
        budgetAmount: opts.budget,
        requestedDeliveryDate: new Date("2026-09-18"),
        originCity: opts.origin,
        destinationCity: opts.dest,
        originLine1: opts.originLine,
        destinationLine1: opts.destLine,
        pickupNotes: opts.vehicle,
        publishedAt: new Date(),
        items: {
          create: [
            {
              productId: opts.productId,
              categoryId: opts.categoryId,
              name: opts.name,
              quantity: opts.qty,
              minQuantity: opts.qty,
              maxQuantity: opts.qty,
              unitCode: opts.unit,
            },
          ],
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
    number: "PR-2026-000041",
    companyId: mahram.company.id,
    userId: mahram.owner.id,
    origin: "تهران",
    dest: "رشت",
    originLine: "کارخانه مهرام جاده مخصوص",
    destLine: "مرکز پخش رشت",
    name: "خیارشور شیشه‌ای مهرام",
    qty: 24,
    unit: "carton",
    productId: pickle.id,
    categoryId: canned.id,
    budget: 9800000,
    vehicle: "TRUCK",
    assign: { driverId: navid.id, jobStatus: "IN_TRANSIT", requestStatus: "IN_TRANSIT", documents: true },
  });
  await cargo({
    number: "PR-2026-000042",
    companyId: mahram.company.id,
    userId: mahram.owner.id,
    origin: "تهران",
    dest: "همدان",
    originLine: "انبار مهرام",
    destLine: "بازار همدان",
    name: "سس مایونز مهرام",
    qty: 16,
    unit: "carton",
    productId: sauce.id,
    categoryId: ctx.foodId,
    budget: 7200000,
    vehicle: "VAN",
    assign: { driverId: leila.id, jobStatus: "AT_PICKUP", requestStatus: "PICKUP_SCHEDULED", documents: true },
  });
  await cargo({
    number: "PR-2026-000043",
    companyId: delpazir.company.id,
    userId: delpazir.owner.id,
    origin: "تهران",
    dest: "یزد",
    originLine: "کارخانه دلپذیر",
    destLine: "مرکز پخش یزد",
    name: "رب گوجه فرنگی حلبی",
    qty: 28,
    unit: "carton",
    productId: paste.id,
    categoryId: canned.id,
    budget: 15200000,
    vehicle: "TRAILER",
    assign: { driverId: farhad.id, jobStatus: "LOADED", requestStatus: "IN_TRANSIT", documents: true },
  });
  await cargo({
    number: "PR-2026-000044",
    companyId: delpazir.company.id,
    userId: delpazir.owner.id,
    origin: "کرج",
    dest: "بندرعباس",
    originLine: "انبار کرج دلپذیر",
    destLine: "اسکله بندرعباس",
    name: "کنسرو لوبیا",
    qty: 40,
    unit: "carton",
    productId: beans.id,
    categoryId: canned.id,
    budget: 18600000,
    vehicle: "TRAILER",
  });
  await cargo({
    number: "PR-2026-000045",
    companyId: yekoyek.company.id,
    userId: yekoyek.owner.id,
    origin: "تهران",
    dest: "کرمان",
    originLine: "سردخانه یک‌و‌یک",
    destLine: "مرکز پخش کرمان",
    name: "سبزیجات منجمد",
    qty: 18,
    unit: "carton",
    productId: veg.id,
    categoryId: frozen.id,
    budget: 11400000,
    vehicle: "REFRIGERATED",
    assign: { driverId: navid.id, jobStatus: "DELIVERED", requestStatus: "DELIVERED", documents: true },
  });
  await cargo({
    number: "PR-2026-000046",
    companyId: yekoyek.company.id,
    userId: yekoyek.owner.id,
    origin: "تهران",
    dest: "ساری",
    originLine: "سردخانه یک‌و‌یک",
    destLine: "فروشگاه زنجیره‌ای ساری",
    name: "مرغ منجمد",
    qty: 12,
    unit: "carton",
    productId: chicken.id,
    categoryId: frozen.id,
    budget: 16400000,
    vehicle: "REFRIGERATED",
  });
  await cargo({
    number: "PR-2026-000047",
    companyId: shirin.company.id,
    userId: shirin.owner.id,
    origin: "تهران",
    dest: "اراک",
    originLine: "کارخانه شیرین‌عسل",
    destLine: "مرکز پخش اراک",
    name: "بیسکویت پذیرایی",
    qty: 36,
    unit: "carton",
    productId: biscuit.id,
    categoryId: ctx.foodId,
    budget: 8900000,
    vehicle: "TRUCK",
    assign: { driverId: hooman.id, jobStatus: "COMPLETED", requestStatus: "COMPLETED", documents: true },
  });
  await cargo({
    number: "PR-2026-000048",
    companyId: shirin.company.id,
    userId: shirin.owner.id,
    origin: "تهران",
    dest: "بوشهر",
    originLine: "انبار شیرین‌عسل",
    destLine: "مرکز پخش بوشهر",
    name: "بیسکویت پذیرایی",
    qty: 22,
    unit: "carton",
    productId: biscuit.id,
    categoryId: ctx.foodId,
    budget: 7600000,
    vehicle: "TRUCK",
    assign: { driverId: farhad.id, jobStatus: "PROOF_SUBMITTED", requestStatus: "DELIVERED", documents: true },
  });

  if (chashniCo && chashniUser) {
    await cargo({
      number: "PR-2026-000049",
      companyId: chashniCo.id,
      userId: chashniUser.id,
      origin: "تهران",
      dest: "ارومیه",
      originLine: "انبار ایران چاشنی",
      destLine: "مرکز پخش ارومیه",
      name: "ادویه و چاشنی کارتنی",
      qty: 15,
      unit: "carton",
      categoryId: ctx.foodId,
      budget: 6400000,
      vehicle: "TRUCK",
      assign: ali ? { driverId: ali.id, jobStatus: "DRIVER_ASSIGNED", requestStatus: "TRANSPORT_ASSIGNED", documents: true } : undefined,
    });
    await cargo({
      number: "PR-2026-000050",
      companyId: chashniCo.id,
      userId: chashniUser.id,
      origin: "تهران",
      dest: "رشت",
      originLine: "انبار ایران چاشنی",
      destLine: "بازار رشت",
      name: "چاشنی و رب ترکیبی",
      qty: 10,
      unit: "carton",
      productId: paste.id,
      categoryId: canned.id,
      budget: 5100000,
      vehicle: "VAN",
    });
  }

  if (kallehCo && kallehUser && mehdi) {
    await cargo({
      number: "PR-2026-000051",
      companyId: kallehCo.id,
      userId: kallehUser.id,
      origin: "کرج",
      dest: "ساری",
      originLine: "سردخانه کاله کرج",
      destLine: "سردخانه ساری",
      name: "شیر پاکتی کاله",
      qty: 32,
      unit: "carton",
      categoryId: ctx.foodId,
      budget: 19800000,
      vehicle: "REFRIGERATED",
      assign: { driverId: mehdi.id, jobStatus: "LOADING", requestStatus: "PICKUP_SCHEDULED", documents: true },
    });
  }

  const completed = await prisma.order.findFirst({ where: { request: { number: "PR-2026-000047" } } });
  if (completed) {
    const ratingExists = await prisma.rating.findFirst({ where: { orderId: completed.id } });
    if (!ratingExists) {
      await prisma.rating.create({
        data: {
          orderId: completed.id,
          raterUserId: shirin.owner.id,
          targetType: "DRIVER",
          targetId: hooman.id,
          overall: 5,
          reliability: 5,
          punctuality: 4,
          comment: "بار بیسکویت بدون شکستگی رسید.",
        },
      });
    }
  }

  const ticketExists = await prisma.supportTicket.findUnique({ where: { number: "TCK-2026-000002" } });
  if (!ticketExists) {
    await prisma.supportTicket.create({
      data: {
        number: "TCK-2026-000002",
        userId: mahram.owner.id,
        category: "حمل",
        priority: "MEDIUM",
        status: "OPEN",
        subject: "نیاز به تریلی برای مسیر بندرعباس",
        assignedToId: ctx.adminId,
        messages: { create: { authorId: mahram.owner.id, body: "برای کنسروهای صادراتی هفته بعد تریلی کم داریم." } },
      },
    });
  }

  await notify(prisma, mahram.owner.id, "بار رشت در مسیر است", "نوید کریمی خیارشور مهرام را بارگیری کرد.", "job.in_transit");
  await notify(prisma, shirin.owner.id, "تحویل اراک تأیید شد", "هومن نوری محموله بیسکویت را تکمیل کرد.", "job.completed");
  await notify(prisma, navid.userId, "دو بار سردخانه‌ای در محدوده شمال", "رشت و ساری درخواست یخچال‌دار دارند.", "job.offered");
  await notify(prisma, ctx.adminId, "چهار شرکت پخش جدید فعال شدند", "مهرام، دلپذیر، یک‌و‌یک و شیرین‌عسل به دمو اضافه شدند.", "company.approved");

  for (const key of ["PR-2026", "ORD-2026", "JOB-2026", "SHP-2026", "INV-2026", "TCK-2026"]) {
    const row = await prisma.numberSequence.findUnique({ where: { key } });
    if (!row || row.lastValue < 80) {
      await prisma.numberSequence.upsert({ where: { key }, create: { key, lastValue: 80 }, update: { lastValue: 80 } });
    }
  }
}
