import { z } from "zod";
import type { DisputeStatus, InvoiceStatus, Prisma, RatingTargetType, TicketStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { nextNumber } from "@/server/numbering";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import {
  createDisputeSchema,
  createRatingSchema,
  createTicketSchema,
  disputeMessageSchema,
  extraKinds,
  requestExtraSchema,
  resolveDisputeSchema,
  sendJobMessageSchema,
  ticketMessageSchema,
  ticketStatusSchema,
  type ExtraKind,
} from "@/lib/validation/ops";

const EXTRA_PREFIX: Record<ExtraKind, string> = {
  DETENTION: "[DETENTION]",
  WAITING: "[WAITING]",
  EXTRA_LABOR: "[EXTRA_LABOR]",
  FUEL: "[FUEL]",
  RETURN: "[RETURN]",
  OTHER: "[OTHER]",
};

const EXTRA_LABEL: Record<ExtraKind, string> = {
  DETENTION: "حق توقف",
  WAITING: "انتظار بارگیری",
  EXTRA_LABOR: "کارگر اضافه",
  FUEL: "سوخت اضافه مسیر",
  RETURN: "برگشت بار",
  OTHER: "هزینه جانبی",
};

function parseExtraKind(description: string): ExtraKind {
  const found = extraKinds.find((kind) => description.startsWith(EXTRA_PREFIX[kind]));
  return found ?? "OTHER";
}

async function notify(userIds: string[], eventType: string, title: string, body: string, payload: Prisma.InputJsonValue) {
  const unique = [...new Set(userIds.filter((id) => id))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      eventType,
      title,
      body,
      payload,
    })),
  });
}

async function loadJobForParty(actor: Actor, jobId: string) {
  const job = await prisma.transportationJob.findUnique({
    where: { id: jobId },
    include: {
      order: { include: { requesterCompany: true, invoices: { include: { lines: true } } } },
      assignedDriver: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!job) throw Errors.notFound();
  const isRequester = actor.memberships.some((m) => m.companyId === job.order.requesterCompanyId);
  const isDriver = actor.driverProfile?.id === job.assignedDriverId;
  if (!actor.isPlatformStaff && !isRequester && !isDriver) throw Errors.notFound();
  return { job, isRequester, isDriver };
}

async function requesterUserIds(companyId: string) {
  const members = await prisma.membership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function ensureJobConversation(jobId: string, requesterCompanyId: string, driverUserId?: string | null) {
  const existing = await prisma.conversation.findFirst({
    where: { entityType: "TransportationJob", entityId: jobId },
    include: {
      participants: true,
      messages: { include: { sender: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (existing) return existing;

  const userIds = await requesterUserIds(requesterCompanyId);
  if (driverUserId) userIds.push(driverUserId);
  const conversation = await prisma.conversation.create({
    data: {
      subject: "هماهنگی بار",
      entityType: "TransportationJob",
      entityId: jobId,
      participants: {
        create: [...new Set(userIds)].map((userId) => ({
          userId,
          companyId: userId === driverUserId ? null : requesterCompanyId,
        })),
      },
    },
    include: {
      participants: true,
      messages: { include: { sender: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  return conversation;
}

function mapMessage(message: { id: string; body: string; createdAt: Date; senderId: string; sender: { firstName: string; lastName: string } }) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    senderId: message.senderId,
    senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
  };
}

export async function listJobMessages(actor: Actor, jobId: string) {
  assertPermission(actor, "messages.read");
  const { job } = await loadJobForParty(actor, jobId);
  const conversation = await ensureJobConversation(job.id, job.order.requesterCompanyId, job.assignedDriver?.user.id);
  return {
    conversationId: conversation.id,
    messages: conversation.messages.map(mapMessage),
  };
}

export async function sendJobMessage(actor: Actor, jobId: string, input: z.infer<typeof sendJobMessageSchema>) {
  assertPermission(actor, "messages.send");
  const { job } = await loadJobForParty(actor, jobId);
  const conversation = await ensureJobConversation(job.id, job.order.requesterCompanyId, job.assignedDriver?.user.id);
  const inThread = conversation.participants.some((p) => p.userId === actor.userId);
  if (!inThread && actor.isPlatformStaff) {
    await prisma.conversationParticipant.create({
      data: { conversationId: conversation.id, userId: actor.userId },
    });
  } else if (!inThread) {
    throw Errors.forbidden("شما در این گفتگو نیستید");
  }

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: actor.userId, body: input.body },
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  });
  const others = conversation.participants.map((p) => p.userId).filter((id): id is string => Boolean(id) && id !== actor.userId);
  await notify(others, "job.message", "پیام جدید بار", input.body.slice(0, 120), { jobId, kind: "job.message" });
  return mapMessage(message);
}

export async function listJobExtras(actor: Actor, jobId: string) {
  const { job } = await loadJobForParty(actor, jobId);
  return job.order.invoices
    .filter((invoice) => invoice.type === "ADJUSTMENT")
    .map((invoice) => {
      const kind = parseExtraKind(invoice.lines?.[0]?.description ?? invoice.number);
      return {
        id: invoice.id,
        kind,
        label: EXTRA_LABEL[kind],
        amount: Number(invoice.total),
        currencyCode: invoice.currencyCode,
        status: invoice.status,
        note: (invoice.lines?.[0]?.description ?? "").replace(/^\[[A-Z_]+\]\s*/, ""),
      };
    });
}

export async function requestJobExtra(actor: Actor, jobId: string, input: z.infer<typeof requestExtraSchema>) {
  const { job, isDriver, isRequester } = await loadJobForParty(actor, jobId);
  if (!actor.isPlatformStaff && !isDriver && !isRequester) throw Errors.forbidden();
  if (!job.assignedDriverId) throw Errors.conflict("هنوز راننده‌ای برای این بار تخصیص نشده است");

  const platform = await prisma.company.findFirst({ where: { type: "PLATFORM" } });
  const description = `${EXTRA_PREFIX[input.kind]} ${EXTRA_LABEL[input.kind]}${input.note ? ` · ${input.note}` : ""}`;
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextNumber("ADJ"),
      type: "ADJUSTMENT",
      orderId: job.orderId,
      issuerCompanyId: platform?.id ?? job.order.requesterCompanyId,
      recipientCompanyId: job.order.requesterCompanyId,
      status: "DRAFT",
      currencyCode: job.currencyCode,
      subtotal: input.amount,
      taxAmount: 0,
      total: input.amount,
      lines: { create: [{ description, quantity: 1, unitPrice: input.amount, lineTotal: input.amount }] },
    },
    include: { lines: true },
  });
  await writeAudit({ actor, action: "job.extra_requested", entityType: "Invoice", entityId: invoice.id, newValue: { jobId, kind: input.kind, amount: input.amount } });
  const recipients = isDriver ? await requesterUserIds(job.order.requesterCompanyId) : job.assignedDriver?.user.id ? [job.assignedDriver.user.id] : [];
  await notify(recipients, "job.extra", "هزینه جانبی جدید", `${EXTRA_LABEL[input.kind]} · ${input.amount.toLocaleString("fa-IR")} ریال`, {
    jobId,
    invoiceId: invoice.id,
    kind: "job.extra",
  });
  return {
    id: invoice.id,
    kind: input.kind,
    label: EXTRA_LABEL[input.kind],
    amount: Number(invoice.total),
    currencyCode: invoice.currencyCode,
    status: invoice.status,
    note: input.note ?? EXTRA_LABEL[input.kind],
  };
}

async function decideExtra(actor: Actor, jobId: string, extraId: string, status: Extract<InvoiceStatus, "ISSUED" | "VOID">) {
  const { job, isRequester } = await loadJobForParty(actor, jobId);
  if (!actor.isPlatformStaff && !isRequester) throw Errors.forbidden("فقط صاحب بار می‌تواند هزینه جانبی را تأیید کند");
  const invoice = job.order.invoices.find((row) => row.id === extraId && row.type === "ADJUSTMENT");
  if (!invoice) throw Errors.notFound();
  if (invoice.status !== "DRAFT") throw Errors.conflict("این هزینه قبلاً بررسی شده است");
  const updated = await prisma.invoice.update({
    where: { id: extraId },
    data: { status, issuedAt: status === "ISSUED" ? new Date() : invoice.issuedAt },
  });
  if (status === "ISSUED") {
    const transport = job.order.invoices.find((row) => row.type === "TRANSPORT" && !["VOID", "CANCELLED", "PAID"].includes(row.status));
    if (transport) {
      const amount = Number(invoice.total);
      await prisma.invoice.update({
        where: { id: transport.id },
        data: {
          subtotal: { increment: amount },
          total: { increment: amount },
          lines: {
            create: {
              description: invoice.lines?.[0]?.description ?? EXTRA_LABEL.OTHER,
              quantity: 1,
              unitPrice: amount,
              lineTotal: amount,
            },
          },
        },
      });
    }
  }
  await writeAudit({ actor, action: status === "ISSUED" ? "job.extra_approved" : "job.extra_rejected", entityType: "Invoice", entityId: extraId });
  if (job.assignedDriver?.user.id) {
    await notify(
      [job.assignedDriver.user.id],
      "job.extra",
      status === "ISSUED" ? "هزینه جانبی تأیید شد" : "هزینه جانبی رد شد",
      `${job.number}`,
      { jobId, invoiceId: extraId, kind: "job.extra" },
    );
  }
  return { id: updated.id, status: updated.status };
}

export async function approveJobExtra(actor: Actor, jobId: string, extraId: string) {
  return decideExtra(actor, jobId, extraId, "ISSUED");
}

export async function rejectJobExtra(actor: Actor, jobId: string, extraId: string) {
  return decideExtra(actor, jobId, extraId, "VOID");
}

export async function listJobRatings(actor: Actor, jobId: string) {
  const { job } = await loadJobForParty(actor, jobId);
  const ratings = await prisma.rating.findMany({
    where: { orderId: job.orderId },
    include: { rater: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ratings.map((rating) => ({
    id: rating.id,
    targetType: rating.targetType,
    targetId: rating.targetId,
    overall: rating.overall,
    punctuality: rating.punctuality,
    communication: rating.communication,
    comment: rating.comment,
    mine: rating.raterUserId === actor.userId,
    rater: `${rating.rater.firstName} ${rating.rater.lastName}`.trim(),
    createdAt: rating.createdAt,
  }));
}

export async function createJobRating(actor: Actor, jobId: string, input: z.infer<typeof createRatingSchema>) {
  assertPermission(actor, "ratings.create");
  const { job, isDriver, isRequester } = await loadJobForParty(actor, jobId);
  if (!["COMPLETED", "CONFIRMED", "PROOF_SUBMITTED", "DELIVERED"].includes(job.status) && job.status !== "DISPUTED") {
    throw Errors.conflict("امتیاز بعد از تحویل بار ثبت می‌شود");
  }
  let targetType: RatingTargetType;
  let targetId: string;
  if (isRequester || (actor.isPlatformStaff && !isDriver)) {
    if (!job.assignedDriverId) throw Errors.conflict("راننده‌ای برای امتیازدهی وجود ندارد");
    targetType = "DRIVER";
    targetId = job.assignedDriverId;
  } else if (isDriver) {
    targetType = "REQUESTER";
    targetId = job.order.requesterCompanyId;
  } else {
    throw Errors.forbidden();
  }

  const rating = await prisma.rating.upsert({
    where: {
      orderId_raterUserId_targetType_targetId: {
        orderId: job.orderId,
        raterUserId: actor.userId,
        targetType,
        targetId,
      },
    },
    create: {
      orderId: job.orderId,
      raterUserId: actor.userId,
      targetType,
      targetId,
      overall: input.overall,
      punctuality: input.punctuality,
      communication: input.communication,
      comment: input.comment,
    },
    update: {
      overall: input.overall,
      punctuality: input.punctuality,
      communication: input.communication,
      comment: input.comment,
    },
  });

  if (targetType === "DRIVER") {
    const agg = await prisma.rating.aggregate({
      where: { targetType: "DRIVER", targetId },
      _avg: { overall: true },
      _count: { _all: true },
    });
    await prisma.driverProfile.update({
      where: { id: targetId },
      data: { ratingAvg: agg._avg.overall ?? input.overall, ratingCount: agg._count._all },
    });
  }

  await writeAudit({ actor, action: "rating.created", entityType: "Rating", entityId: rating.id, newValue: { jobId, targetType, overall: input.overall } });
  return rating;
}

function canSeeDispute(actor: Actor, dispute: { reporterId: string; order: { requesterCompanyId: string; jobs: Array<{ assignedDriverId: string | null }> } | null }) {
  if (actor.isPlatformStaff) return true;
  if (dispute.reporterId === actor.userId) return true;
  if (dispute.order && actor.memberships.some((m) => m.companyId === dispute.order!.requesterCompanyId)) return true;
  if (actor.driverProfile && dispute.order?.jobs.some((job) => job.assignedDriverId === actor.driverProfile!.id)) return true;
  return false;
}

function mapDispute(dispute: {
  id: string;
  number: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  reporter: { firstName: string; lastName: string };
  order: { id: string; number: string; jobs: Array<{ id: string; number: string }> } | null;
  messages: Array<{ id: string; body: string; createdAt: Date; authorId: string }>;
}) {
  return {
    id: dispute.id,
    number: dispute.number,
    reason: dispute.reason,
    description: dispute.description,
    status: dispute.status,
    resolution: dispute.resolution,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    reporter: `${dispute.reporter.firstName} ${dispute.reporter.lastName}`.trim(),
    orderId: dispute.order?.id ?? null,
    orderNumber: dispute.order?.number ?? null,
    jobId: dispute.order?.jobs[0]?.id ?? null,
    jobNumber: dispute.order?.jobs[0]?.number ?? null,
    messages: dispute.messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      authorId: message.authorId,
    })),
  };
}

const disputeInclude = {
  reporter: { select: { firstName: true, lastName: true } },
  messages: { orderBy: { createdAt: "asc" as const } },
  order: { include: { jobs: { select: { id: true, number: true, assignedDriverId: true } } } },
};

export async function listDisputes(actor: Actor) {
  assertPermission(actor, "disputes.read");
  const companyIds = actor.memberships.map((m) => m.companyId);
  const rows = await prisma.dispute.findMany({
    where: actor.isPlatformStaff
      ? undefined
      : {
          OR: [
            { reporterId: actor.userId },
            companyIds.length ? { order: { requesterCompanyId: { in: companyIds } } } : undefined,
            actor.driverProfile ? { order: { jobs: { some: { assignedDriverId: actor.driverProfile.id } } } } : undefined,
          ].filter(Boolean) as object[],
        },
    include: disputeInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.filter((row) => canSeeDispute(actor, row)).map(mapDispute);
}

export async function getDispute(actor: Actor, id: string) {
  assertPermission(actor, "disputes.read");
  const dispute = await prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
  if (!dispute || !canSeeDispute(actor, dispute)) throw Errors.notFound();
  return mapDispute(dispute);
}

export async function createDispute(actor: Actor, input: z.infer<typeof createDisputeSchema>) {
  assertPermission(actor, "disputes.create");
  let orderId = input.orderId ?? null;
  let jobId = input.jobId ?? null;
  if (input.jobId) {
    const { job } = await loadJobForParty(actor, input.jobId);
    orderId = job.orderId;
    jobId = job.id;
    await prisma.transportationJob.update({
      where: { id: job.id },
      data: { status: job.status === "COMPLETED" ? job.status : "DISPUTED" },
    });
  } else if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { jobs: true } });
    if (!order) throw Errors.notFound();
    if (!actor.isPlatformStaff && !actor.memberships.some((m) => m.companyId === order.requesterCompanyId)) {
      throw Errors.forbidden();
    }
    jobId = order.jobs[0]?.id ?? null;
  }

  const dispute = await prisma.dispute.create({
    data: {
      number: await nextNumber("DSP"),
      orderId,
      reporterId: actor.userId,
      reason: input.reason,
      description: input.description,
      status: "OPEN",
    },
    include: disputeInclude,
  });
  await writeAudit({ actor, action: "dispute.opened", entityType: "Dispute", entityId: dispute.id, newValue: { jobId, reason: input.reason } });
  const staff = await prisma.userRole.findMany({
    where: { role: { portal: "PLATFORM" } },
    select: { userId: true },
  });
  await notify(
    staff.map((row) => row.userId),
    "dispute.opened",
    "اختلاف بار جدید",
    `${dispute.number} · ${input.reason}`,
    { jobId: jobId ?? undefined, kind: "dispute.opened" },
  );
  return mapDispute(dispute);
}

export async function addDisputeMessage(actor: Actor, id: string, input: z.infer<typeof disputeMessageSchema>) {
  const dispute = await prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
  if (!dispute || !canSeeDispute(actor, dispute)) throw Errors.notFound();
  if (["RESOLVED", "REJECTED", "CLOSED"].includes(dispute.status)) {
    throw Errors.conflict("این اختلاف بسته شده است");
  }
  await prisma.disputeMessage.create({ data: { disputeId: id, authorId: actor.userId, body: input.body } });
  if (dispute.status === "OPEN") {
    await prisma.dispute.update({ where: { id }, data: { status: "UNDER_REVIEW" } });
  }
  return getDispute(actor, id);
}

export async function resolveDispute(actor: Actor, id: string, input: z.infer<typeof resolveDisputeSchema>) {
  assertPermission(actor, "disputes.manage");
  const dispute = await prisma.dispute.findUnique({ where: { id }, include: { order: { include: { jobs: true } } } });
  if (!dispute) throw Errors.notFound();
  await prisma.dispute.update({
    where: { id },
    data: { status: input.status, resolution: input.resolution, resolvedAt: new Date() },
  });
  if (input.status === "RESOLVED" && dispute.order?.jobs[0] && dispute.order.jobs[0].status === "DISPUTED") {
    await prisma.transportationJob.update({
      where: { id: dispute.order.jobs[0].id },
      data: { status: "COMPLETED" },
    });
  }
  await writeAudit({ actor, action: "dispute.resolved", entityType: "Dispute", entityId: id, newValue: input });
  return getDispute(actor, id);
}

function canSeeTicket(actor: Actor, ticket: { userId: string }) {
  return actor.isPlatformStaff || ticket.userId === actor.userId;
}

function mapTicket(ticket: {
  id: string;
  number: string;
  category: string;
  priority: string;
  status: TicketStatus;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  messages: Array<{ id: string; body: string; createdAt: Date; authorId: string; author: { firstName: string; lastName: string } }>;
}) {
  return {
    id: ticket.id,
    number: ticket.number,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    subject: ticket.subject,
    relatedType: ticket.relatedType,
    relatedId: ticket.relatedId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    mine: true,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      authorId: message.authorId,
      authorName: `${message.author.firstName} ${message.author.lastName}`.trim(),
    })),
  };
}

const ticketInclude = {
  messages: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" as const } },
};

export async function listTickets(actor: Actor) {
  assertPermission(actor, "tickets.read");
  const rows = await prisma.supportTicket.findMany({
    where: actor.isPlatformStaff ? undefined : { userId: actor.userId },
    include: ticketInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({ ...mapTicket(row), mine: row.userId === actor.userId }));
}

export async function getTicket(actor: Actor, id: string) {
  assertPermission(actor, "tickets.read");
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
  if (!ticket || !canSeeTicket(actor, ticket)) throw Errors.notFound();
  return { ...mapTicket(ticket), mine: ticket.userId === actor.userId };
}

export async function createTicket(actor: Actor, input: z.infer<typeof createTicketSchema>) {
  assertPermission(actor, "tickets.create");
  const ticket = await prisma.supportTicket.create({
    data: {
      number: await nextNumber("TCK"),
      userId: actor.userId,
      category: input.category,
      priority: input.priority ?? "MEDIUM",
      subject: input.subject,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      messages: { create: { authorId: actor.userId, body: input.body } },
    },
    include: ticketInclude,
  });
  const staff = await prisma.userRole.findMany({
    where: { role: { portal: "PLATFORM" } },
    select: { userId: true },
  });
  await notify(staff.map((row) => row.userId), "ticket.opened", "تیکت پشتیبانی جدید", ticket.subject, { kind: "ticket.opened" });
  return mapTicket(ticket);
}

export async function addTicketMessage(actor: Actor, id: string, input: z.infer<typeof ticketMessageSchema>) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || !canSeeTicket(actor, ticket)) throw Errors.notFound();
  if (["RESOLVED", "CLOSED"].includes(ticket.status) && !actor.isPlatformStaff) {
    throw Errors.conflict("این تیکت بسته شده است");
  }
  await prisma.ticketMessage.create({ data: { ticketId: id, authorId: actor.userId, body: input.body } });
  await prisma.supportTicket.update({
    where: { id },
    data: { status: actor.isPlatformStaff ? "WAITING_FOR_USER" : ticket.status === "WAITING_FOR_USER" ? "IN_PROGRESS" : ticket.status },
  });
  return getTicket(actor, id);
}

export async function updateTicketStatus(actor: Actor, id: string, input: z.infer<typeof ticketStatusSchema>) {
  assertPermission(actor, "tickets.manage");
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw Errors.notFound();
  await prisma.supportTicket.update({ where: { id }, data: { status: input.status } });
  await notify([ticket.userId], "ticket.updated", "به‌روزرسانی تیکت پشتیبانی", `${ticket.number} · ${input.status}`, { kind: "ticket.updated" });
  return getTicket(actor, id);
}

export { EXTRA_LABEL };
