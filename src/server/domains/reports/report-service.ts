import { prisma } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";
import { addJalaliMonths, formatJalaliMonth, jalaliToIso, parseCalendarDate, toJalali } from "@/lib/shamsi";

export type ReportKpi = { key: string; value: number; unit?: "money" | "count" };
export type ReportSeriesPoint = { key: string; label: string; requests: number; jobs: number; amount: number };
export type ReportStatus = { status: string; count: number };
export type ReportRoute = { origin: string; destination: string; count: number; amount: number };
export type ReportRecent = {
  id: string;
  kind: "request" | "job" | "invoice" | "order";
  number: string;
  status: string;
  title: string;
  amount?: number | null;
  currencyCode?: string;
  at: string;
};

export type ReportsPayload = {
  portal: string;
  period: { from: string; to: string };
  kpis: ReportKpi[];
  series: ReportSeriesPoint[];
  statuses: ReportStatus[];
  routes: ReportRoute[];
  recent: ReportRecent[];
};

function num(value: unknown) {
  return Number(value ?? 0);
}

function monthKey(date: Date) {
  const { jy, jm } = toJalali(date);
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return formatJalaliMonth(year, month);
}

function emptyMonths(from: Date, to: Date): ReportSeriesPoint[] {
  const out: ReportSeriesPoint[] = [];
  const start = toJalali(from);
  const end = toJalali(to);
  let cursor = { jy: start.jy, jm: start.jm };
  while (cursor.jy < end.jy || (cursor.jy === end.jy && cursor.jm <= end.jm)) {
    const key = `${cursor.jy}-${String(cursor.jm).padStart(2, "0")}`;
    out.push({ key, label: monthLabel(key), requests: 0, jobs: 0, amount: 0 });
    cursor = addJalaliMonths(cursor.jy, cursor.jm, 1);
  }
  return out;
}

function bump(series: ReportSeriesPoint[], date: Date, field: "requests" | "jobs" | "amount", value = 1) {
  const point = series.find((item) => item.key === monthKey(date));
  if (point) point[field] += value;
}

function countBy(items: Array<{ status: string }>): ReportStatus[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
  return [...map.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

function addRoute(map: Map<string, ReportRoute>, origin: string | null | undefined, destination: string | null | undefined, amount = 0) {
  const from = origin?.trim() || "نامشخص";
  const to = destination?.trim() || "نامشخص";
  const key = `${from}|${to}`;
  const current = map.get(key) ?? { origin: from, destination: to, count: 0, amount: 0 };
  current.count += 1;
  current.amount += amount;
  map.set(key, current);
}

function topRoutes(map: Map<string, ReportRoute>, take = 6) {
  return [...map.values()].sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, take);
}

export async function reportsFor(actor: Actor): Promise<ReportsPayload> {
  const to = new Date();
  const now = toJalali(to);
  const start = addJalaliMonths(now.jy, now.jm, -5);
  const from = parseCalendarDate(jalaliToIso(start.jy, start.jm, 1));

  if (actor.isPlatformStaff) return platformReports(from, to);

  if (actor.portal === "DRIVER" && actor.driverProfile) {
    return driverReports(actor.driverProfile.id, from, to);
  }

  const requesterId = actor.memberships.find((m) => m.companyType === "REQUESTER")?.companyId;
  if (requesterId && actor.portal !== "SUPPLIER" && actor.portal !== "DRIVER") {
    return requesterReports(requesterId, from, to);
  }

  const supplierId = actor.memberships.find((m) => m.companyType === "SUPPLIER")?.companyId;
  if (supplierId) return supplierReports(supplierId, from, to);

  if (actor.driverProfile) return driverReports(actor.driverProfile.id, from, to);

  return emptyPayload("UNKNOWN", from, to);
}

function emptyPayload(portal: string, from: Date, to: Date): ReportsPayload {
  return {
    portal,
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: [],
    series: emptyMonths(from, to),
    statuses: [],
    routes: [],
    recent: [],
  };
}

async function platformReports(from: Date, to: Date): Promise<ReportsPayload> {
  const [requests, jobs, invoices, companies, drivers] = await Promise.all([
    prisma.procurementRequest.findMany({
      where: { createdAt: { gte: from } },
      select: { id: true, number: true, status: true, originCity: true, destinationCity: true, budgetAmount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transportationJob.findMany({
      where: { createdAt: { gte: from } },
      select: {
        id: true,
        number: true,
        status: true,
        compensationAmount: true,
        createdAt: true,
        shipment: { select: { trackingNumber: true } },
        order: { select: { request: { select: { originCity: true, destinationCity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: from } },
      select: { id: true, number: true, status: true, total: true, currencyCode: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.count({ where: { type: "REQUESTER", status: "APPROVED" } }),
    prisma.driverProfile.count({ where: { status: "APPROVED" } }),
  ]);

  const series = emptyMonths(from, to);
  const routes = new Map<string, ReportRoute>();
  for (const request of requests) {
    bump(series, request.createdAt, "requests");
    bump(series, request.createdAt, "amount", num(request.budgetAmount));
    addRoute(routes, request.originCity, request.destinationCity, num(request.budgetAmount));
  }
  for (const job of jobs) {
    bump(series, job.createdAt, "jobs");
    addRoute(routes, job.order.request?.originCity, job.order.request?.destinationCity, num(job.compensationAmount));
  }

  const invoiceTotal = invoices.reduce((sum, invoice) => sum + num(invoice.total), 0);
  const recent: ReportRecent[] = [
    ...requests.slice(0, 4).map((row) => ({
      id: row.id,
      kind: "request" as const,
      number: row.number,
      status: row.status,
      title: [row.originCity, row.destinationCity].filter(Boolean).join(" ← ") || row.number,
      amount: num(row.budgetAmount),
      at: row.createdAt.toISOString(),
    })),
    ...jobs.slice(0, 4).map((row) => ({
      id: row.id,
      kind: "job" as const,
      number: row.shipment?.trackingNumber || row.number,
      status: row.status,
      title: [row.order.request?.originCity, row.order.request?.destinationCity].filter(Boolean).join(" ← ") || row.number,
      amount: num(row.compensationAmount),
      at: row.createdAt.toISOString(),
    })),
    ...invoices.slice(0, 4).map((row) => ({
      id: row.id,
      kind: "invoice" as const,
      number: row.number,
      status: row.status,
      title: "فاکتور حمل",
      amount: num(row.total),
      currencyCode: row.currencyCode,
      at: row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8);

  return {
    portal: "PLATFORM",
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: [
      { key: "requests", value: requests.length, unit: "count" },
      { key: "jobs", value: jobs.length, unit: "count" },
      { key: "invoiceTotal", value: invoiceTotal, unit: "money" },
      { key: "cargoOwners", value: companies, unit: "count" },
      { key: "drivers", value: drivers, unit: "count" },
    ],
    series,
    statuses: countBy(jobs.length ? jobs : requests),
    routes: topRoutes(routes),
    recent,
  };
}

async function requesterReports(companyId: string, from: Date, to: Date): Promise<ReportsPayload> {
  const [requests, jobs, invoices] = await Promise.all([
    prisma.procurementRequest.findMany({
      where: { companyId, createdAt: { gte: from } },
      select: { id: true, number: true, status: true, originCity: true, destinationCity: true, budgetAmount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transportationJob.findMany({
      where: { order: { requesterCompanyId: companyId }, createdAt: { gte: from } },
      select: {
        id: true,
        number: true,
        status: true,
        compensationAmount: true,
        createdAt: true,
        shipment: { select: { trackingNumber: true } },
        order: { select: { request: { select: { originCity: true, destinationCity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { recipientCompanyId: companyId, createdAt: { gte: from } },
      select: { id: true, number: true, status: true, total: true, currencyCode: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const series = emptyMonths(from, to);
  const routes = new Map<string, ReportRoute>();
  for (const request of requests) {
    bump(series, request.createdAt, "requests");
    bump(series, request.createdAt, "amount", num(request.budgetAmount));
    addRoute(routes, request.originCity, request.destinationCity, num(request.budgetAmount));
  }
  for (const job of jobs) {
    bump(series, job.createdAt, "jobs");
  }

  const invoiceTotal = invoices.reduce((sum, invoice) => sum + num(invoice.total), 0);
  const unpaid = invoices.filter((invoice) => !["PAID", "VOID", "CANCELLED"].includes(invoice.status)).reduce((sum, invoice) => sum + num(invoice.total), 0);
  const waiting = jobs.filter((job) => ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING"].includes(job.status)).length;

  const recent: ReportRecent[] = [
    ...requests.slice(0, 5).map((row) => ({
      id: row.id,
      kind: "request" as const,
      number: row.number,
      status: row.status,
      title: [row.originCity, row.destinationCity].filter(Boolean).join(" ← ") || row.number,
      amount: num(row.budgetAmount),
      at: row.createdAt.toISOString(),
    })),
    ...invoices.slice(0, 4).map((row) => ({
      id: row.id,
      kind: "invoice" as const,
      number: row.number,
      status: row.status,
      title: "فاکتور حمل",
      amount: num(row.total),
      currencyCode: row.currencyCode,
      at: row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8);

  return {
    portal: "REQUESTER",
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: [
      { key: "requests", value: requests.length, unit: "count" },
      { key: "jobs", value: jobs.length, unit: "count" },
      { key: "waitingDrivers", value: waiting, unit: "count" },
      { key: "invoiceTotal", value: invoiceTotal, unit: "money" },
      { key: "unpaid", value: unpaid, unit: "money" },
    ],
    series,
    statuses: countBy(requests),
    routes: topRoutes(routes),
    recent,
  };
}

async function driverReports(driverId: string, from: Date, to: Date): Promise<ReportsPayload> {
  const [jobs, matches] = await Promise.all([
    prisma.transportationJob.findMany({
      where: { assignedDriverId: driverId, createdAt: { gte: from } },
      select: {
        id: true,
        number: true,
        status: true,
        compensationAmount: true,
        currencyCode: true,
        createdAt: true,
        shipment: { select: { trackingNumber: true } },
        order: {
          select: {
            requesterCompany: { select: { tradeName: true } },
            request: { select: { originCity: true, destinationCity: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.driverMatch.count({ where: { driverId, eligible: true } }),
  ]);

  const series = emptyMonths(from, to);
  const routes = new Map<string, ReportRoute>();
  for (const job of jobs) {
    bump(series, job.createdAt, "jobs");
    const fare = num(job.compensationAmount);
    if (["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"].includes(job.status)) {
      bump(series, job.createdAt, "amount", fare);
    }
    addRoute(routes, job.order.request?.originCity, job.order.request?.destinationCity, fare);
  }

  const completed = jobs.filter((job) => ["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"].includes(job.status));
  const active = jobs.filter((job) => !["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(job.status));
  const earnings = completed.reduce((sum, job) => sum + num(job.compensationAmount), 0);

  return {
    portal: "DRIVER",
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: [
      { key: "availableJobs", value: matches, unit: "count" },
      { key: "activeJobs", value: active.length, unit: "count" },
      { key: "completedJobs", value: completed.length, unit: "count" },
      { key: "earnings", value: earnings, unit: "money" },
    ],
    series,
    statuses: countBy(jobs),
    routes: topRoutes(routes),
    recent: jobs.slice(0, 8).map((row) => ({
      id: row.id,
      kind: "job" as const,
      number: row.shipment?.trackingNumber || row.number,
      status: row.status,
      title: row.order.requesterCompany.tradeName || [row.order.request?.originCity, row.order.request?.destinationCity].filter(Boolean).join(" ← "),
      amount: num(row.compensationAmount),
      currencyCode: row.currencyCode,
      at: row.createdAt.toISOString(),
    })),
  };
}

async function supplierReports(companyId: string, from: Date, to: Date): Promise<ReportsPayload> {
  const [orders, jobs] = await Promise.all([
    prisma.order.findMany({
      where: { supplierCompanyId: companyId, createdAt: { gte: from } },
      select: { id: true, number: true, status: true, merchandiseTotal: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transportationJob.findMany({
      where: { order: { supplierCompanyId: companyId }, createdAt: { gte: from } },
      select: {
        id: true,
        number: true,
        status: true,
        compensationAmount: true,
        createdAt: true,
        order: { select: { request: { select: { originCity: true, destinationCity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const series = emptyMonths(from, to);
  const routes = new Map<string, ReportRoute>();
  for (const job of jobs) {
    bump(series, job.createdAt, "jobs");
    addRoute(routes, job.order.request?.originCity, job.order.request?.destinationCity, num(job.compensationAmount));
  }

  return {
    portal: "SUPPLIER",
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: [
      { key: "orders", value: orders.length, unit: "count" },
      { key: "jobs", value: jobs.length, unit: "count" },
    ],
    series,
    statuses: countBy(orders),
    routes: topRoutes(routes),
    recent: orders.slice(0, 8).map((row) => ({
      id: row.id,
      kind: "order" as const,
      number: row.number,
      status: row.status,
      title: "سفارش",
      amount: num(row.merchandiseTotal),
      at: row.createdAt.toISOString(),
    })),
  };
}
