import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { hashPassword } from "@/server/auth/password";
import { ensurePriceBook, getPriceBookForCompany } from "@/server/domains/finance/price-book-service";

export async function getCompanyProfile(actor: Actor, id: string) {
  assertPermission(actor, "companies.read");
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: { select: { firstName: true, lastName: true, phone: true, email: true, status: true } } },
      },
      warehouses: { include: { address: true } },
      addresses: true,
      requests: { orderBy: { createdAt: "desc" }, take: 8, include: { items: true } },
      requesterOrders: { orderBy: { createdAt: "desc" }, take: 6, include: { invoices: true, jobs: true } },
    },
  });
  if (!company || company.type === "PLATFORM") throw Errors.notFound();

  return {
    id: company.id,
    type: company.type,
    status: company.status,
    legalName: company.legalName,
    tradeName: company.tradeName,
    registrationNumber: company.registrationNumber,
    taxId: company.taxId,
    email: company.email,
    phone: company.phone,
    website: company.website,
    defaultCurrency: company.defaultCurrency,
    verificationNotes: company.verificationNotes,
    rejectedReason: company.rejectedReason,
    verifiedAt: company.verifiedAt,
    createdAt: company.createdAt,
    members: company.memberships.map((m) => ({
      title: m.title,
      isOwner: m.isOwner,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      phone: m.user.phone,
      email: m.user.email,
      status: m.user.status,
    })),
    warehouses: company.warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      status: w.status,
      city: w.address.city,
      region: w.address.region,
      line1: w.address.line1,
      postalCode: w.address.postalCode,
    })),
    addresses: company.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
    })),
    requests: company.requests.map((req) => ({
      id: req.id,
      number: req.number,
      status: req.status,
      originCity: req.originCity,
      destinationCity: req.destinationCity,
      requestedDeliveryDate: req.requestedDeliveryDate,
      items: req.items.map((item) => `${item.name} ${Number(item.quantity)} ${item.unitCode}`),
    })),
    orders: company.requesterOrders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      invoiceCount: order.invoices.length,
      jobCount: order.jobs.length,
    })),
    priceBook: await getPriceBookForCompany(actor, company.id),
  };
}

export async function createCargoCompany(
  actor: Actor,
  input: {
    tradeName: string;
    legalName?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    registrationNumber?: string;
    ownerFirstName: string;
    ownerLastName: string;
    ownerEmail: string;
    ownerPhone?: string;
    ownerPassword: string;
  },
) {
  assertPermission(actor, "companies.create");
  const passwordHash = await hashPassword(input.ownerPassword);
  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        type: "REQUESTER",
        status: "APPROVED",
        tradeName: input.tradeName,
        legalName: input.legalName || input.tradeName,
        phone: input.phone,
        email: input.email,
        taxId: input.taxId,
        registrationNumber: input.registrationNumber,
        verifiedAt: new Date(),
        verifiedById: actor.userId,
      },
    });
    const user = await tx.user.create({
      data: {
        email: input.ownerEmail.toLowerCase(),
        phone: input.ownerPhone,
        passwordHash,
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    await tx.membership.create({ data: { userId: user.id, companyId: company.id, isOwner: true } });
    const role = await tx.role.findFirst({ where: { code: "REQUESTER_OWNER", isSystem: true } });
    if (role) await tx.userRole.create({ data: { userId: user.id, roleId: role.id, companyId: company.id } });
    return company;
  });
  await ensurePriceBook(created.id, `دفترچه قیمت ${created.tradeName}`);
  return created;
}
