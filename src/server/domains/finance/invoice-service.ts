import { prisma } from "@/server/db";
import { nextNumber } from "@/server/numbering";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";

function canSeeInvoice(
  actor: Actor,
  invoice: { issuerCompanyId: string; recipientCompanyId: string },
) {
  if (actor.isPlatformStaff) return true;
  return actor.memberships.some(
    (m) => m.companyId === invoice.issuerCompanyId || m.companyId === invoice.recipientCompanyId,
  );
}

function mapInvoice(invoice: {
  id: string;
  number: string;
  type: string;
  status: string;
  currencyCode: string;
  subtotal: unknown;
  taxAmount: unknown;
  total: unknown;
  issuedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  issuer: { id: string; tradeName: string; legalName: string; phone: string | null; email: string | null; taxId: string | null; registrationNumber: string | null };
  recipient: { id: string; tradeName: string; legalName: string; phone: string | null; email: string | null; taxId: string | null; registrationNumber: string | null };
  lines: Array<{ id: string; description: string; quantity: unknown; unitPrice: unknown; lineTotal: unknown }>;
  payments?: Array<{ id: string; status: string; provider: string; amount: unknown; paidAt: Date | null; createdAt: Date }>;
  order: {
    id: string;
    number: string;
    status: string;
    transportTotal: unknown;
    request?: {
      id: string;
      number: string;
      originCity: string | null;
      destinationCity: string | null;
      originLine1: string | null;
      destinationLine1: string | null;
      notes: string | null;
      pickupNotes: string | null;
      items: Array<{ name: string; quantity: unknown; unitCode: string }>;
    } | null;
    jobs: Array<{
      id: string;
      number: string;
      status: string;
      cargoWeight: unknown;
      cargoUnit: string;
      requiredVehicleType: string | null;
      compensationAmount: unknown;
      shipment: { trackingNumber: string | null } | null;
      assignedDriver: {
        id: string;
        licenseNumber: string | null;
        ratingAvg: unknown;
        user: { firstName: string; lastName: string; phone: string | null };
      } | null;
    }>;
  } | null;
}) {
  const job = invoice.order?.jobs[0] ?? null;
  const driver = job?.assignedDriver ?? null;
  return {
    id: invoice.id,
    number: invoice.number,
    type: invoice.type,
    status: invoice.status,
    currencyCode: invoice.currencyCode,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    createdAt: invoice.createdAt,
    issuer: {
      id: invoice.issuer.id,
      name: invoice.issuer.tradeName,
      legalName: invoice.issuer.legalName,
      phone: invoice.issuer.phone,
      email: invoice.issuer.email,
      taxId: invoice.issuer.taxId,
      registrationNumber: invoice.issuer.registrationNumber,
    },
    recipient: {
      id: invoice.recipient.id,
      name: invoice.recipient.tradeName,
      legalName: invoice.recipient.legalName,
      phone: invoice.recipient.phone,
      email: invoice.recipient.email,
      taxId: invoice.recipient.taxId,
      registrationNumber: invoice.recipient.registrationNumber,
    },
    issuerName: invoice.issuer.tradeName,
    recipientName: invoice.recipient.tradeName,
    orderId: invoice.order?.id ?? null,
    orderNumber: invoice.order?.number ?? "—",
    orderStatus: invoice.order?.status ?? null,
    requestId: invoice.order?.request?.id ?? null,
    requestNumber: invoice.order?.request?.number ?? null,
    originCity: invoice.order?.request?.originCity ?? null,
    destinationCity: invoice.order?.request?.destinationCity ?? null,
    originLine1: invoice.order?.request?.originLine1 ?? null,
    destinationLine1: invoice.order?.request?.destinationLine1 ?? null,
    cargoNotes: invoice.order?.request?.notes ?? null,
    pickupNotes: invoice.order?.request?.pickupNotes ?? null,
    cargoItems: (invoice.order?.request?.items ?? []).map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitCode: item.unitCode,
    })),
    jobId: job?.id ?? null,
    jobNumber: job?.number ?? null,
    jobStatus: job?.status ?? null,
    cargoWeight: job ? Number(job.cargoWeight) : null,
    cargoUnit: job?.cargoUnit ?? null,
    requiredVehicleType: job?.requiredVehicleType ?? null,
    fare: job?.compensationAmount != null ? Number(job.compensationAmount) : Number(invoice.order?.transportTotal ?? 0),
    waybill: job?.shipment?.trackingNumber ?? null,
    driver: driver
      ? {
          id: driver.id,
          name: `${driver.user.firstName} ${driver.user.lastName}`.trim(),
          phone: driver.user.phone,
          licenseNumber: driver.licenseNumber,
          ratingAvg: Number(driver.ratingAvg),
        }
      : null,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
    payments: (invoice.payments ?? []).map((payment) => ({
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      amount: Number(payment.amount),
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
    payable: ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status),
  };
}

function mapInvoiceForActor(
  invoice: Parameters<typeof mapInvoice>[0],
  actor: Actor,
) {
  const mapped = mapInvoice(invoice);
  const isRecipient = actor.memberships.some((m) => m.companyId === invoice.recipient.id);
  return {
    ...mapped,
    payable: mapped.payable && (actor.isPlatformStaff || isRecipient),
  };
}

const invoiceInclude = {
  lines: true,
  payments: true,
  issuer: true,
  recipient: true,
  order: {
    include: {
      request: { include: { items: true } },
      jobs: {
        include: {
          shipment: true,
          assignedDriver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        },
      },
    },
  },
} as const;

export async function listInvoices(actor: Actor) {
  assertPermission(actor, "invoices.read");
  const companyIds = actor.memberships.map((m) => m.companyId);
  const invoices = await prisma.invoice.findMany({
    where: actor.isPlatformStaff
      ? undefined
      : { OR: [{ issuerCompanyId: { in: companyIds } }, { recipientCompanyId: { in: companyIds } }] },
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return invoices.map((invoice) => mapInvoiceForActor(invoice, actor));
}

export async function getInvoice(actor: Actor, id: string) {
  assertPermission(actor, "invoices.read");
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceInclude,
  });
  if (!invoice || !canSeeInvoice(actor, invoice)) throw Errors.notFound();
  return mapInvoiceForActor(invoice, actor);
}

export async function issueTransportDocuments(orderId: string, jobId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { requesterCompany: true, jobs: true, invoices: true },
  });
  if (!order) return null;
  if (order.invoices.length) return order.invoices[0];

  const platform = await prisma.company.findFirst({ where: { type: "PLATFORM" } });
  const amount = Number(order.transportTotal || order.merchandiseTotal || 0) || 2500000;
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextNumber("INV"),
      type: "TRANSPORT",
      orderId: order.id,
      issuerCompanyId: platform?.id ?? order.requesterCompanyId,
      recipientCompanyId: order.requesterCompanyId,
      status: "ISSUED",
      currencyCode: order.currencyCode,
      subtotal: amount,
      taxAmount: 0,
      total: amount,
      issuedAt: new Date(),
      lines: {
        create: [{ description: "کرایه حمل و صدور بارنامه", quantity: 1, unitPrice: amount, lineTotal: amount }],
      },
    },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { transportTotal: amount },
  });
  return invoice;
}

export async function payInvoice(actor: Actor, id: string) {
  assertPermission(actor, "invoices.read");
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceInclude,
  });
  if (!invoice || !canSeeInvoice(actor, invoice)) throw Errors.notFound();
  const isRecipient = actor.memberships.some((m) => m.companyId === invoice.recipientCompanyId);
  if (!actor.isPlatformStaff && !isRecipient) {
    throw Errors.forbidden("فقط گیرنده فاکتور می‌تواند آن را تسویه کند");
  }
  if (!["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
    throw Errors.conflict("این فاکتور قابل پرداخت نیست");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        status: "COMPLETED",
        provider: "MANUAL",
        providerRef: `PAY-${invoice.number}`,
        amount: invoice.total,
        currencyCode: invoice.currencyCode,
        paidAt: new Date(),
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID" },
    });
  });
  await writeAudit({ actor, action: "invoice.paid", entityType: "Invoice", entityId: invoice.id, newValue: { amount: Number(invoice.total) } });
  return getInvoice(actor, id);
}
