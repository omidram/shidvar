import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { SYSTEM_ROLES, PERMISSIONS } from "../src/server/rbac/permissions";
import { DEFAULT_DRIVER_WEIGHTS, DEFAULT_SUPPLIER_WEIGHTS } from "../src/server/matching/weights";
import { RULE_DEFAULTS } from "../src/server/settings/rules";
import { dispatchCargoToDrivers } from "../src/server/domains/logistics/cargo-dispatch";
import { runDriverMatching } from "../src/server/domains/matching/run-driver-matching";
import { seedLiveData } from "./live-data";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SHIDVAR_DEMO !== "1") {
    throw new Error("Refusing to seed production");
  }

  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  for (const code of PERMISSIONS) {
    await prisma.permission.create({ data: { code, name: code } });
  }

  for (const [code, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.create({
      data: { code, name: def.name, isSystem: true, portal: def.portal },
    });
    const perms = await prisma.permission.findMany({ where: { code: { in: def.permissions } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  for (const [key, value] of Object.entries(RULE_DEFAULTS)) {
    await prisma.businessRule.upsert({
      where: { key },
      create: { key, value: value as object, description: key },
      update: { value: value as object },
    });
  }
  await prisma.businessRule.upsert({
    where: { key: "matching.supplier.weights" },
    create: { key: "matching.supplier.weights", value: DEFAULT_SUPPLIER_WEIGHTS, description: "Supplier matching weights" },
    update: { value: DEFAULT_SUPPLIER_WEIGHTS },
  });
  await prisma.businessRule.upsert({
    where: { key: "matching.driver.weights" },
    create: { key: "matching.driver.weights", value: DEFAULT_DRIVER_WEIGHTS, description: "Driver matching weights" },
    update: { value: DEFAULT_DRIVER_WEIGHTS },
  });

  await prisma.currency.upsert({
    where: { code: "IRR" },
    create: { code: "IRR", nameEn: "Iranian Rial", nameFa: "ریال", decimals: 0 },
    update: {},
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    create: { code: "USD", nameEn: "US Dollar", nameFa: "دلار", decimals: 2 },
    update: {},
  });
  for (const unit of [
    { code: "kg", nameEn: "Kilogram", nameFa: "کیلوگرم", dimension: "mass" },
    { code: "ton", nameEn: "Ton", nameFa: "تن", dimension: "mass" },
    { code: "g", nameEn: "Gram", nameFa: "گرم", dimension: "mass" },
    { code: "l", nameEn: "Liter", nameFa: "لیتر", dimension: "volume" },
    { code: "m", nameEn: "Meter", nameFa: "متر", dimension: "length" },
    { code: "km", nameEn: "Kilometer", nameFa: "کیلومتر", dimension: "length" },
    { code: "carton", nameEn: "Carton", nameFa: "کارتن", dimension: "count" },
    { code: "box", nameEn: "Box", nameFa: "جعبه", dimension: "count" },
    { code: "pallet", nameEn: "Pallet", nameFa: "پالت", dimension: "count" },
  ]) {
    await prisma.unit.upsert({ where: { code: unit.code }, create: unit, update: unit });
  }

  const iran = await prisma.geographicArea.upsert({
    where: { type_code: { type: "COUNTRY", code: "IR" } },
    create: { type: "COUNTRY", code: "IR", nameEn: "Iran", nameFa: "ایران" },
    update: {},
  });
  const tehranRegion = await prisma.geographicArea.upsert({
    where: { type_code: { type: "REGION", code: "TEH" } },
    create: { type: "REGION", code: "TEH", nameEn: "Tehran", nameFa: "تهران", parentId: iran.id },
    update: {},
  });
  const tehranCity = await prisma.geographicArea.upsert({
    where: { type_code: { type: "CITY", code: "THR" } },
    create: { type: "CITY", code: "THR", nameEn: "Tehran", nameFa: "تهران", parentId: tehranRegion.id },
    update: {},
  });
  const karajCity = await prisma.geographicArea.upsert({
    where: { type_code: { type: "CITY", code: "KRJ" } },
    create: { type: "CITY", code: "KRJ", nameEn: "Karaj", nameFa: "کرج", parentId: tehranRegion.id },
    update: {},
  });
  const mazandaran = await prisma.geographicArea.upsert({
    where: { type_code: { type: "REGION", code: "MZN" } },
    create: { type: "REGION", code: "MZN", nameEn: "Mazandaran", nameFa: "مازندران", parentId: iran.id },
    update: {},
  });
  const amolCity = await prisma.geographicArea.upsert({
    where: { type_code: { type: "CITY", code: "AML" } },
    create: { type: "CITY", code: "AML", nameEn: "Amol", nameFa: "آمل", parentId: mazandaran.id },
    update: {},
  });

  const food = await prisma.productCategory.upsert({
    where: { code: "FOOD" },
    create: { code: "FOOD", nameEn: "Food", nameFa: "مواد غذایی" },
    update: {},
  });
  const rice = await prisma.product.upsert({
    where: { sku: "RICE-001" },
    create: { sku: "RICE-001", nameEn: "Rice", nameFa: "برنج", categoryId: food.id, defaultUnit: "ton" },
    update: {},
  });
  const oil = await prisma.product.upsert({
    where: { sku: "OIL-001" },
    create: { sku: "OIL-001", nameEn: "Cooking oil", nameFa: "روغن", categoryId: food.id, defaultUnit: "ton" },
    update: {},
  });
  const sugar = await prisma.product.upsert({
    where: { sku: "SUGAR-001" },
    create: { sku: "SUGAR-001", nameEn: "Sugar", nameFa: "شکر", categoryId: food.id, defaultUnit: "ton" },
    update: {},
  });
  const flour = await prisma.product.upsert({
    where: { sku: "FLOUR-001" },
    create: { sku: "FLOUR-001", nameEn: "Flour", nameFa: "آرد", categoryId: food.id, defaultUnit: "ton" },
    update: {},
  });
  const macaroni = await prisma.product.upsert({
    where: { sku: "MAC-001" },
    create: { sku: "MAC-001", nameEn: "Macaroni", nameFa: "ماکارونی کارتن ۲۵تایی", categoryId: food.id, defaultUnit: "carton" },
    update: { nameFa: "ماکارونی کارتن ۲۵تایی", defaultUnit: "carton" },
  });

  const adminRole = await prisma.role.findFirstOrThrow({ where: { code: "SUPER_ADMIN" } });
  const requesterRole = await prisma.role.findFirstOrThrow({ where: { code: "REQUESTER_OWNER" } });
  const supplierRole = await prisma.role.findFirstOrThrow({ where: { code: "SUPPLIER_OWNER" } });
  const driverRole = await prisma.role.findFirstOrThrow({ where: { code: "DRIVER" } });

  const platform = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      type: "PLATFORM",
      status: "APPROVED",
      legalName: "Shidvar",
      tradeName: "Shidvar",
    },
    update: { status: "APPROVED" },
  });

  async function upsertUser(opts: {
    id: string;
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    roleId: string;
    companyId: string;
  }) {
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

  const admin = await upsertUser({
    id: "00000000-0000-0000-0000-000000000011",
    email: "admin@shidvar.local",
    phone: "09120000001",
    password: "DevAdmin!2026",
    firstName: "آرمین",
    lastName: "مدیری",
    roleId: adminRole.id,
    companyId: platform.id,
  });

  const requesterCo = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      type: "REQUESTER",
      status: "APPROVED",
      legalName: "Zar Macaron Distribution",
      tradeName: "شرکت پخش زر ماکارون",
      phone: "02188000000",
      verifiedAt: new Date(),
      verifiedById: admin.id,
    },
    update: { status: "APPROVED", legalName: "Zar Macaron Distribution", tradeName: "شرکت پخش زر ماکارون" },
  });

  const supplierCo = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      type: "SUPPLIER",
      status: "APPROVED",
      legalName: "Pars Grain Co",
      tradeName: "پارس غلات",
      phone: "02166000000",
      verifiedAt: new Date(),
      verifiedById: admin.id,
    },
    update: { status: "APPROVED" },
  });

  const carrierCo = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      type: "CARRIER",
      status: "APPROVED",
      legalName: "Rezaei Fleet",
      tradeName: "ناوگان رضایی",
      verifiedAt: new Date(),
      verifiedById: admin.id,
    },
    update: { status: "APPROVED" },
  });

  const buyer = await upsertUser({
    id: "00000000-0000-0000-0000-000000000012",
    email: "buyer@alpha-stores.local",
    phone: "09121111111",
    password: "DevStore!2026",
    firstName: "ندا",
    lastName: "کریمی",
    roleId: requesterRole.id,
    companyId: requesterCo.id,
  });

  await upsertUser({
    id: "00000000-0000-0000-0000-000000000013",
    email: "sales@pars-grain.local",
    phone: "09125678901",
    password: "DevSupplier!2026",
    firstName: "Reza",
    lastName: "Pars",
    roleId: supplierRole.id,
    companyId: supplierCo.id,
  });

  const driverUser = await upsertUser({
    id: "00000000-0000-0000-0000-000000000014",
    email: "ali.rezaei@fleet.local",
    phone: "09121234567",
    password: "DevDriver!2026",
    firstName: "علی",
    lastName: "رضایی",
    roleId: driverRole.id,
    companyId: carrierCo.id,
  });

  await prisma.supplierProfile.upsert({
    where: { companyId: supplierCo.id },
    create: {
      companyId: supplierCo.id,
      status: "APPROVED",
      ratingAvg: 4.8,
      ratingCount: 40,
      fulfillmentRate: 0.96,
      onTimeRate: 0.94,
    },
    update: { status: "APPROVED" },
  });
  await prisma.carrierProfile.upsert({
    where: { companyId: carrierCo.id },
    create: { companyId: carrierCo.id, status: "APPROVED", ratingAvg: 4.6, onTimeRate: 0.91 },
    update: { status: "APPROVED" },
  });

  const destAddress = await prisma.address.create({
    data: {
      companyId: requesterCo.id,
      line1: "Distribution Center 4, Karaj Road",
      city: "Karaj",
      region: "Alborz",
      countryCode: "IR",
      latitude: 35.8327,
      longitude: 50.9915,
      geographicAreaId: karajCity.id,
    },
  });
  const pickupAddress = await prisma.address.create({
    data: {
      companyId: supplierCo.id,
      line1: "Pars Grain Warehouse, Shams-Abad",
      city: "Tehran",
      region: "Tehran",
      countryCode: "IR",
      latitude: 35.6892,
      longitude: 51.389,
      geographicAreaId: tehranCity.id,
    },
  });

  const store = await prisma.store.upsert({
    where: { companyId_code: { companyId: requesterCo.id, code: "WH4" } },
    create: { companyId: requesterCo.id, code: "WH4", name: "Warehouse #4", addressId: destAddress.id },
    update: {},
  });
  const destWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: requesterCo.id, code: "DC-4" } },
    create: {
      companyId: requesterCo.id,
      storeId: store.id,
      code: "DC-4",
      name: "Alpha DC 4",
      addressId: destAddress.id,
    },
    update: {},
  });
  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: supplierCo.id, code: "PG-1" } },
    create: {
      companyId: supplierCo.id,
      code: "PG-1",
      name: "Pars Grain Main",
      addressId: pickupAddress.id,
    },
    update: {},
  });

  for (const [product, name, price] of [
    [rice, "Rice Grade A", 850000000],
    [oil, "Cooking oil", 1200000000],
    [sugar, "Sugar", 700000000],
    [flour, "Flour", 500000000],
  ] as const) {
    const existing = await prisma.supplierProduct.findFirst({
      where: { supplierCompanyId: supplierCo.id, productId: product.id },
    });
    const sp =
      existing ??
      (await prisma.supplierProduct.create({
        data: {
          supplierCompanyId: supplierCo.id,
          productId: product.id,
          categoryId: food.id,
          name,
          unitCode: "ton",
          indicativePrice: price,
        },
      }));
    await prisma.supplierCapacity.create({
      data: { supplierCompanyId: supplierCo.id, supplierProductId: sp.id, quantity: 80, unitCode: "ton" },
    });
  }
  await prisma.supplierCertification.create({
    data: { supplierCompanyId: supplierCo.id, type: "ISO22000", number: "IR-22000-1" },
  });
  await prisma.operatingArea.createMany({
    data: [
      { ownerType: "SUPPLIER", ownerId: supplierCo.id, geographicAreaId: tehranCity.id },
      { ownerType: "SUPPLIER", ownerId: supplierCo.id, geographicAreaId: karajCity.id },
    ],
    skipDuplicates: true,
  });

  const driver = await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    create: {
      userId: driverUser.id,
      carrierCompanyId: carrierCo.id,
      status: "APPROVED",
      licenseNumber: "12345678",
      licenseType: "base-2",
      licenseExpiresAt: new Date("2029-01-01"),
      ratingAvg: 4.8,
      completedJobs: 149,
      lastKnownLat: 35.7,
      lastKnownLng: 51.4,
    },
    update: { status: "APPROVED" },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { companyId_plateNumber: { companyId: carrierCo.id, plateNumber: "12-IRN-345" } },
    create: {
      companyId: carrierCo.id,
      plateNumber: "12-IRN-345",
      vehicleType: "HEAVY_TRUCK",
      weightCapacity: 60,
      volumeCapacity: 80,
      status: "AVAILABLE",
    },
    update: { status: "AVAILABLE" },
  });
  await prisma.driverVehicle.upsert({
    where: { driverId_vehicleId: { driverId: driver.id, vehicleId: vehicle.id } },
    create: { driverId: driver.id, vehicleId: vehicle.id, isPrimary: true },
    update: {},
  });
  await prisma.operatingArea.createMany({
    data: [
      { ownerType: "DRIVER", ownerId: driver.id, geographicAreaId: tehranCity.id },
      { ownerType: "DRIVER", ownerId: driver.id, geographicAreaId: karajCity.id },
      { ownerType: "DRIVER", ownerId: driver.id, geographicAreaId: amolCity.id },
    ],
    skipDuplicates: true,
  });

  const pendingDriverUser = await upsertUser({
    id: "00000000-0000-0000-0000-000000000015",
    email: "pending.driver@fleet.local",
    phone: "09129990000",
    password: "DevDriver!2026",
    firstName: "حسین",
    lastName: "محمدی",
    roleId: driverRole.id,
    companyId: carrierCo.id,
  });
  await prisma.driverProfile.upsert({
    where: { userId: pendingDriverUser.id },
    create: {
      userId: pendingDriverUser.id,
      carrierCompanyId: carrierCo.id,
      status: "UNDER_REVIEW",
      licenseNumber: "87654321",
      licenseType: "base-2",
    },
    update: { status: "UNDER_REVIEW" },
  });

  const existingCargo = await prisma.procurementRequest.findFirst({ where: { number: "PR-2026-000010" } });
  if (!existingCargo) {
    const request = await prisma.procurementRequest.create({
      data: {
        number: "PR-2026-000010",
        companyId: requesterCo.id,
        createdById: buyer.id,
        status: "MATCHING",
        currencyCode: "IRR",
        budgetAmount: 8500000,
        requestedDeliveryDate: new Date("2026-09-01"),
        originCity: "تهران",
        destinationCity: "آمل",
        originLine1: "انبار مرکزی زر ماکارون، تهران",
        destinationLine1: "مرکز پخش آمل",
        pickupNotes: "TRUCK",
        packagingNotes: "کارتن ۲۵تایی",
        publishedAt: new Date(),
        items: {
          create: [
            {
              productId: macaroni.id,
              categoryId: food.id,
              name: "ماکارونی کارتن ۲۵تایی",
              quantity: 5,
              minQuantity: 5,
              maxQuantity: 5,
              unitCode: "carton",
            },
          ],
        },
      },
    });
    await prisma.operatingArea.create({
      data: { ownerType: "REQUEST", ownerId: request.id, geographicAreaId: tehranCity.id },
    });
    await prisma.numberSequence.upsert({
      where: { key: "PR-2026" },
      create: { key: "PR-2026", lastValue: 10 },
      update: { lastValue: 10 },
    });
    await dispatchCargoToDrivers(request.id);
  } else {
    const order = await prisma.order.findFirst({
      where: { requestId: existingCargo.id },
      include: { jobs: true },
    });
    if (order?.jobs[0]) await runDriverMatching(order.jobs[0].id);
  }

  await seedLiveData(prisma, {
    adminId: admin.id,
    platformId: platform.id,
    foodId: food.id,
    requesterRoleId: requesterRole.id,
    driverRoleId: driverRole.id,
    zarCompanyId: requesterCo.id,
    zarUserId: buyer.id,
    aliDriverId: driver.id,
    aliUserId: driverUser.id,
  });

  console.log("Seed complete.");
  console.log("Admin      admin@shidvar.local / DevAdmin!2026");
  console.log("Cargo owner buyer@alpha-stores.local / DevStore!2026");
  console.log("Driver     ali.rezaei@fleet.local / DevDriver!2026");
  console.log("Pending    pending.driver@fleet.local / DevDriver!2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
