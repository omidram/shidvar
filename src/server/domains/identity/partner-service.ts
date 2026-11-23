import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { hashPassword, passwordPolicy } from "@/server/auth/password";
import { nextNumber } from "@/server/numbering";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { normalizeMobile } from "@/lib/identity";
import { isPastDate } from "@/lib/shamsi";

const partnerInclude = {
  company: { select: { id: true, tradeName: true, phone: true, status: true } },
  driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
  invoice: { select: { id: true, number: true, status: true, total: true } },
} as const;

function partnerCompanyId(actor: Actor) {
  return actor.memberships.find((item) => item.companyType === "PARTNER")?.companyId ?? null;
}

function mapShipment(row: {
  id: string;
  number: string;
  invoiceNumber: string;
  brandName: string;
  storeName: string;
  cargoType: string;
  cartonCount: number;
  cargoAmount: { toString(): string };
  province: string;
  county: string | null;
  city: string;
  warehouseName: string;
  receivedAt: Date | null;
  promisedDeliveryAt: Date | null;
  shipAt: Date;
  notes: string | null;
  status: string;
  driverLocation: string | null;
  freightAmount: { toString(): string } | null;
  deliveredAt: Date | null;
  createdAt: Date;
  company: { id: string; tradeName: string; phone: string | null; status: string };
  driver: { id: string; user: { firstName: string; lastName: string; phone: string | null } } | null;
  invoice: { id: string; number: string; status: string; total: { toString(): string } } | null;
}) {
  return {
    id: row.id,
    number: row.number,
    invoiceNumber: row.invoiceNumber,
    brandName: row.brandName,
    storeName: row.storeName,
    cargoType: row.cargoType,
    cartonCount: row.cartonCount,
    cargoAmount: Number(row.cargoAmount),
    province: row.province,
    county: row.county,
    city: row.city,
    warehouseName: row.warehouseName,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    promisedDeliveryAt: row.promisedDeliveryAt?.toISOString() ?? null,
    shipAt: row.shipAt.toISOString(),
    notes: row.notes,
    status: row.status,
    driverLocation: row.driverLocation,
    freightAmount: row.freightAmount != null ? Number(row.freightAmount) : null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    company: row.company,
    driver: row.driver
      ? {
          id: row.driver.id,
          name: `${row.driver.user.firstName} ${row.driver.user.lastName}`.trim(),
          phone: row.driver.user.phone,
        }
      : null,
    invoice: row.invoice
      ? { id: row.invoice.id, number: row.invoice.number, status: row.invoice.status, total: Number(row.invoice.total) }
      : null,
  };
}

export async function listPartnerShipments(actor: Actor) {
  assertPermission(actor, "requests.read");
  const companyId = partnerCompanyId(actor);
  if (!companyId && !actor.isPlatformStaff) throw Errors.forbidden();
  const rows = await prisma.partnerShipment.findMany({
    where: actor.isPlatformStaff ? undefined : { companyId: companyId! },
    include: partnerInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(mapShipment);
}

export async function listDriverCompletedTrips(actor: Actor) {
  assertPermission(actor, "jobs.read");
  if (!actor.driverProfile) throw Errors.forbidden();
  const driverId = actor.driverProfile.id;
  const [partners, jobs] = await Promise.all([
    prisma.partnerShipment.findMany({
      where: { driverId, status: "DELIVERED" },
      include: partnerInclude,
      orderBy: { deliveredAt: "desc" },
      take: 100,
    }),
    prisma.transportationJob.findMany({
      where: { assignedDriverId: driverId, status: { in: ["PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        order: {
          select: {
            requesterCompany: { select: { tradeName: true } },
            request: { select: { originCity: true, destinationCity: true } },
            items: { select: { name: true }, take: 4 },
          },
        },
        pickupWarehouse: { select: { address: { select: { city: true } } } },
        deliveryWarehouse: { select: { address: { select: { city: true } } } },
      },
    }),
  ]);
  const rows = [
    ...partners.map((row) => ({
      id: row.id,
      kind: "partner" as const,
      number: row.number,
      title: row.brandName,
      source: row.company.tradeName,
      sourceKind: "طرف قرارداد",
      from: row.warehouseName || "شورآباد",
      to: [row.province, row.city].filter(Boolean).join("، "),
      cargo: row.cargoType,
      cartonCount: row.cartonCount,
      status: row.status,
      completedAt: (row.deliveredAt ?? row.updatedAt).toISOString(),
    })),
    ...jobs.map((job) => ({
      id: job.id,
      kind: "job" as const,
      number: job.number,
      title: job.order.requesterCompany.tradeName,
      source: job.order.requesterCompany.tradeName,
      sourceKind: "صاحب بار",
      from: job.order.request?.originCity ?? job.pickupWarehouse?.address?.city ?? "مبدأ",
      to: job.order.request?.destinationCity ?? job.deliveryWarehouse?.address?.city ?? "مقصد",
      cargo: job.order.items.map((item) => item.name).filter(Boolean).join("، ") || "بار",
      cartonCount: null as number | null,
      status: job.status,
      completedAt: job.updatedAt.toISOString(),
    })),
  ];
  return rows.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
}

export async function listDriverPartnerShipments(actor: Actor) {
  assertPermission(actor, "jobs.read");
  if (!actor.driverProfile) throw Errors.forbidden();
  const rows = await prisma.partnerShipment.findMany({
    where: { driverId: actor.driverProfile.id, status: { in: ["ASSIGNED", "IN_TRANSIT"] } },
    include: partnerInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(mapShipment);
}

export async function getDriverPartnerShipment(actor: Actor, id: string) {
  assertPermission(actor, "jobs.read");
  if (!actor.driverProfile) throw Errors.forbidden();
  const row = await prisma.partnerShipment.findFirst({
    where: { id, driverId: actor.driverProfile.id },
    include: partnerInclude,
  });
  if (!row) throw Errors.notFound();
  return mapShipment(row);
}

export async function getPartnerShipment(actor: Actor, id: string) {
  assertPermission(actor, "requests.read");
  const row = await prisma.partnerShipment.findUnique({ where: { id }, include: partnerInclude });
  if (!row) throw Errors.notFound();
  const companyId = partnerCompanyId(actor);
  if (!actor.isPlatformStaff && row.companyId !== companyId) throw Errors.notFound();
  return mapShipment(row);
}

export async function createPartnerShipment(
  actor: Actor,
  input: {
    invoiceNumber: string;
    brandName: string;
    storeName: string;
    cargoType: string;
    cartonCount: number;
    cargoAmount: number;
    province: string;
    county?: string;
    city: string;
    warehouseName?: string;
    receivedAt?: string;
    promisedDeliveryAt?: string;
    shipAt: string;
    notes?: string;
  },
) {
  assertPermission(actor, "requests.create");
  const companyId = partnerCompanyId(actor);
  if (!companyId) throw Errors.forbidden("حساب طرف قرارداد لازم است");
  for (const [field, value] of [
    ["receivedAt", input.receivedAt],
    ["promisedDeliveryAt", input.promisedDeliveryAt],
    ["shipAt", input.shipAt],
  ] as const) {
    if (value && isPastDate(value)) throw Errors.validation({ [field]: ["تاریخ نمی‌تواند از امروز عقب‌تر باشد"] });
  }
  const shipAt = new Date(input.shipAt);
  if (Number.isNaN(shipAt.getTime())) throw Errors.validation({ shipAt: ["زمان ارسال معتبر نیست"] });
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : null;
  const promisedDeliveryAt = input.promisedDeliveryAt ? new Date(input.promisedDeliveryAt) : null;
  const row = await prisma.partnerShipment.create({
    data: {
      number: await nextNumber("PS"),
      companyId,
      createdById: actor.userId,
      invoiceNumber: input.invoiceNumber.trim(),
      brandName: input.brandName.trim(),
      storeName: input.storeName.trim(),
      cargoType: input.cargoType.trim(),
      cartonCount: input.cartonCount,
      cargoAmount: input.cargoAmount,
      province: input.province.trim(),
      county: input.county?.trim() || null,
      city: input.city.trim(),
      warehouseName: input.warehouseName?.trim() || "شورآباد",
      receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
      promisedDeliveryAt: promisedDeliveryAt && !Number.isNaN(promisedDeliveryAt.getTime()) ? promisedDeliveryAt : null,
      shipAt,
      notes: input.notes?.trim() || null,
      status: "REGISTERED",
    },
    include: partnerInclude,
  });
  await writeAudit({ actor, action: "partner.shipment_created", entityType: "PartnerShipment", entityId: row.id });
  return mapShipment(row);
}

export async function listPartners(actor: Actor) {
  assertPermission(actor, "companies.read");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const companies = await prisma.company.findMany({
    where: { type: "PARTNER", deletedAt: null },
    include: {
      memberships: { where: { isOwner: true }, include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true } } } },
      addresses: { take: 1, orderBy: { createdAt: "asc" }, select: { line1: true, city: true, region: true } },
      _count: { select: { partnerShipments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return companies.map((company) => {
    const owner = company.memberships[0]?.user;
    const address = company.addresses[0];
    return {
      id: company.id,
      tradeName: company.tradeName,
      legalName: company.legalName,
      phone: company.phone,
      status: company.status,
      shipmentCount: company._count.partnerShipments,
      addressLine: address?.line1 ?? "",
      city: address?.city ?? "",
      province: address?.region ?? "",
      owner: owner
        ? {
            id: owner.id,
            name: `${owner.firstName} ${owner.lastName}`.trim(),
            firstName: owner.firstName,
            lastName: owner.lastName,
            phone: owner.phone,
            username: owner.email,
            status: owner.status,
          }
        : null,
    };
  });
}

export async function createPartnerAccount(
  actor: Actor,
  input: { tradeName: string; phone?: string; firstName: string; lastName: string; username: string; password: string },
) {
  assertPermission(actor, "companies.create");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const policy = passwordPolicy(input.password);
  if (policy.length) throw Errors.validation({ password: policy });
  const username = input.username.trim().toLowerCase();
  const phone = input.phone?.trim() ? normalizeMobile(input.phone) : null;
  const passwordHash = await hashPassword(input.password);
  let created: { companyId: string; userId: string };
  try {
  created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        type: "PARTNER",
        status: "APPROVED",
        tradeName: input.tradeName.trim(),
        legalName: input.tradeName.trim(),
        phone,
        verifiedAt: new Date(),
        verifiedById: actor.userId,
      },
    });
    const user = await tx.user.create({
      data: {
        email: username,
        phone,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: phone ? new Date() : null,
      },
    });
    await tx.membership.create({ data: { userId: user.id, companyId: company.id, isOwner: true, status: "ACTIVE" } });
    return { companyId: company.id, userId: user.id };
  });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Errors.conflict("این نام کاربری یا موبایل قبلاً ثبت شده است");
    }
    throw error;
  }
  await writeAudit({ actor, action: "partner.account_created", entityType: "Company", entityId: created.companyId });
  return created;
}

export async function updatePartnerProfile(
  actor: Actor,
  companyId: string,
  input: { tradeName: string; phone: string; firstName: string; lastName: string; addressLine: string; city: string; province: string },
) {
  assertPermission(actor, "companies.update");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "PARTNER", deletedAt: null } });
  if (!company) throw Errors.notFound();
  const phone = input.phone.trim() ? normalizeMobile(input.phone) : null;
  const membership = await prisma.membership.findFirst({ where: { companyId, isOwner: true } });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { tradeName: input.tradeName.trim(), legalName: input.tradeName.trim(), phone },
      });
      if (membership) {
        await tx.user.update({
          where: { id: membership.userId },
          data: { firstName: input.firstName.trim(), lastName: input.lastName.trim(), phone },
        });
      }
      const line1 = input.addressLine.trim();
      if (line1) {
        const address = await tx.address.findFirst({ where: { companyId }, orderBy: { createdAt: "asc" } });
        const data = { line1, city: input.city.trim(), region: input.province.trim(), label: "دفتر" };
        if (address) await tx.address.update({ where: { id: address.id }, data });
        else await tx.address.create({ data: { ...data, companyId } });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Errors.conflict("این موبایل قبلاً برای حساب دیگری ثبت شده است");
    }
    throw error;
  }
  await writeAudit({ actor, action: "partner.profile_updated", entityType: "Company", entityId: companyId });
  return { updated: true as const };
}

export async function setPartnerPassword(actor: Actor, companyId: string, password: string) {
  assertPermission(actor, "users.update");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const policy = passwordPolicy(password);
  if (policy.length) throw Errors.validation({ password: policy });
  const membership = await prisma.membership.findFirst({
    where: { companyId, isOwner: true, company: { type: "PARTNER" } },
  });
  if (!membership) throw Errors.notFound();
  await prisma.user.update({ where: { id: membership.userId }, data: { passwordHash: await hashPassword(password) } });
  await writeAudit({ actor, action: "partner.password_set", entityType: "User", entityId: membership.userId });
  return { updated: true as const };
}

export async function setPartnerStatus(actor: Actor, companyId: string, status: "APPROVED" | "SUSPENDED") {
  assertPermission(actor, "companies.suspend");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "PARTNER" } });
  if (!company) throw Errors.notFound();
  await prisma.company.update({ where: { id: companyId }, data: { status } });
  await prisma.user.updateMany({
    where: { memberships: { some: { companyId, isOwner: true } } },
    data: { status: status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" },
  });
  return { status };
}

async function staffShipment(id: string) {
  const row = await prisma.partnerShipment.findUnique({ where: { id }, include: partnerInclude });
  if (!row) throw Errors.notFound();
  return row;
}

export async function assignPartnerDriver(
  actor: Actor,
  id: string,
  input: { driverId: string; freightAmount: number; driverLocation?: string },
) {
  assertPermission(actor, "jobs.assign");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  if (!(input.freightAmount > 0)) throw Errors.validation({ freightAmount: ["مبلغ باربری را وارد کنید"] });
  const row = await staffShipment(id);
  if (!["REGISTERED", "ASSIGNED"].includes(row.status)) throw Errors.conflict("این بار دیگر برای تخصیص راننده باز نیست");
  const driver = await prisma.driverProfile.findFirst({ where: { id: input.driverId, status: "APPROVED" } });
  if (!driver) throw Errors.validation({ driverId: ["راننده تأییدشده پیدا نشد"] });
  const updated = await prisma.partnerShipment.update({
    where: { id },
    data: {
      driverId: driver.id,
      freightAmount: input.freightAmount,
      driverLocation: input.driverLocation?.trim() || row.driverLocation,
      status: "ASSIGNED",
    },
    include: partnerInclude,
  });
  await writeAudit({ actor, action: "partner.driver_assigned", entityType: "PartnerShipment", entityId: id });
  return mapShipment(updated);
}

export async function setPartnerDriverLocation(actor: Actor, id: string, driverLocation: string) {
  assertPermission(actor, "jobs.assign");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  await staffShipment(id);
  const updated = await prisma.partnerShipment.update({
    where: { id },
    data: { driverLocation: driverLocation.trim() },
    include: partnerInclude,
  });
  return mapShipment(updated);
}

export async function dispatchPartnerShipment(actor: Actor, id: string) {
  assertPermission(actor, "jobs.update_status");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const row = await staffShipment(id);
  if (row.status !== "ASSIGNED" || !row.driverId) throw Errors.conflict("اول راننده و مبلغ باربری را ثبت کنید");
  const updated = await prisma.partnerShipment.update({
    where: { id },
    data: { status: "IN_TRANSIT" },
    include: partnerInclude,
  });
  return mapShipment(updated);
}

export async function deliverPartnerShipment(actor: Actor, id: string) {
  assertPermission(actor, "jobs.update_status");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const row = await staffShipment(id);
  if (row.status !== "IN_TRANSIT") throw Errors.conflict("بار هنوز در مسیر نیست");
  const updated = await prisma.partnerShipment.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
    include: partnerInclude,
  });
  return mapShipment(updated);
}

export async function invoicePartnerShipment(actor: Actor, id: string) {
  assertPermission(actor, "invoices.manage");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const row = await staffShipment(id);
  if (row.invoiceId) return mapShipment(row);
  if (row.freightAmount == null) throw Errors.conflict("مبلغ باربری هنوز مشخص نشده است");
  const platform = await prisma.company.findFirst({ where: { type: "PLATFORM" } });
  if (!platform) throw Errors.conflict("شرکت سامانه برای صدور فاکتور پیدا نشد");
  const amount = Number(row.freightAmount);
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextNumber("INV"),
      type: "TRANSPORT",
      issuerCompanyId: platform.id,
      recipientCompanyId: row.companyId,
      status: "ISSUED",
      currencyCode: "IRR",
      subtotal: amount,
      taxAmount: 0,
      total: amount,
      issuedAt: new Date(),
      lines: {
        create: [
          {
            description: `کرایه حمل ${row.number} به ${row.city} · فاکتور ${row.invoiceNumber}`,
            quantity: 1,
            unitPrice: amount,
            lineTotal: amount,
          },
        ],
      },
    },
  });
  const updated = await prisma.partnerShipment.update({
    where: { id },
    data: { invoiceId: invoice.id },
    include: partnerInclude,
  });
  await writeAudit({ actor, action: "partner.invoice_issued", entityType: "Invoice", entityId: invoice.id });
  return mapShipment(updated);
}

export async function listAssignableDrivers(actor: Actor) {
  assertPermission(actor, "drivers.read");
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const rows = await prisma.driverProfile.findMany({
    where: { status: "APPROVED" },
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: { user: { firstName: "asc" } },
    take: 300,
  });
  return rows.map((row) => ({
    id: row.id,
    name: `${row.user.firstName} ${row.user.lastName}`.trim() || row.user.phone || "راننده",
    phone: row.user.phone,
  }));
}
