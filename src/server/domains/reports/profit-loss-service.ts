import ExcelJS from "exceljs";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { addJalaliMonths, formatJalaliMonth, JALALI_MONTHS, jalaliToIso, parseCalendarDate, toFaDigits, toJalali } from "@/lib/shamsi";

export type Granularity = "daily" | "monthly";

export type ProfitLossRow = {
  key: string;
  label: string;
  transportIncome: number;
  commissionIncome: number;
  income: number;
  driverCost: number;
  profit: number;
  jobs: number;
};

export type ProfitLossPayload = {
  granularity: Granularity;
  from: string;
  to: string;
  rows: ProfitLossRow[];
  totals: Omit<ProfitLossRow, "key" | "label">;
};

const DONE_JOB_STATUSES = ["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"] as const;
const COUNTED_INVOICE_EXCLUDED = ["DRAFT", "VOID", "CANCELLED"] as const;

function num(value: unknown) {
  return Number(value ?? 0);
}

function dayKey(date: Date) {
  const { jy, jm, jd } = toJalali(date);
  return `${jy}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  const { jy, jm } = toJalali(date);
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

function buildBuckets(granularity: Granularity, count: number) {
  const buckets: ProfitLossRow[] = [];
  const now = new Date();
  const blank = (key: string, label: string): ProfitLossRow => ({
    key,
    label,
    transportIncome: 0,
    commissionIncome: 0,
    income: 0,
    driverCost: 0,
    profit: 0,
    jobs: 0,
  });
  if (granularity === "daily") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const { jy, jm, jd } = toJalali(date);
      buckets.push(blank(dayKey(date), `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`));
    }
    return { buckets, from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1)) };
  }
  const current = toJalali(now);
  const first = addJalaliMonths(current.jy, current.jm, -(count - 1));
  for (let i = 0; i < count; i++) {
    const { jy, jm } = addJalaliMonths(first.jy, first.jm, i);
    buckets.push(blank(`${jy}-${String(jm).padStart(2, "0")}`, formatJalaliMonth(jy, jm)));
  }
  return { buckets, from: parseCalendarDate(jalaliToIso(first.jy, first.jm, 1)) };
}

function sumTotals(rows: ProfitLossRow[]): ProfitLossPayload["totals"] {
  return rows.reduce(
    (acc, row) => ({
      transportIncome: acc.transportIncome + row.transportIncome,
      commissionIncome: acc.commissionIncome + row.commissionIncome,
      income: acc.income + row.income,
      driverCost: acc.driverCost + row.driverCost,
      profit: acc.profit + row.profit,
      jobs: acc.jobs + row.jobs,
    }),
    { transportIncome: 0, commissionIncome: 0, income: 0, driverCost: 0, profit: 0, jobs: 0 },
  );
}

export async function profitLossReport(
  actor: Actor,
  input: { granularity?: string | null; count?: number | null },
): Promise<ProfitLossPayload> {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const granularity: Granularity = input.granularity === "monthly" ? "monthly" : "daily";
  const max = granularity === "daily" ? 92 : 24;
  const fallback = granularity === "daily" ? 30 : 12;
  const count = Math.min(max, Math.max(1, Math.floor(input.count ?? fallback) || fallback));
  const { buckets, from } = buildBuckets(granularity, count);
  const to = new Date();
  const keyOf = granularity === "daily" ? dayKey : monthKey;
  const index = new Map(buckets.map((row) => [row.key, row]));

  const [invoices, jobs] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        type: { in: ["TRANSPORT", "COMMISSION"] },
        status: { notIn: [...COUNTED_INVOICE_EXCLUDED] },
        OR: [{ issuedAt: { gte: from } }, { issuedAt: null, createdAt: { gte: from } }],
      },
      select: { type: true, total: true, issuedAt: true, createdAt: true },
    }),
    prisma.transportationJob.findMany({
      where: { status: { in: [...DONE_JOB_STATUSES] }, updatedAt: { gte: from } },
      select: { compensationAmount: true, updatedAt: true },
    }),
  ]);

  for (const invoice of invoices) {
    const row = index.get(keyOf(invoice.issuedAt ?? invoice.createdAt));
    if (!row) continue;
    if (invoice.type === "COMMISSION") row.commissionIncome += num(invoice.total);
    else row.transportIncome += num(invoice.total);
  }
  for (const job of jobs) {
    const row = index.get(keyOf(job.updatedAt));
    if (!row) continue;
    row.driverCost += num(job.compensationAmount);
    row.jobs += 1;
  }
  for (const row of buckets) {
    row.income = row.transportIncome + row.commissionIncome;
    row.profit = row.income - row.driverCost;
  }

  return {
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    rows: buckets,
    totals: sumTotals(buckets),
  };
}

export async function profitLossWorkbook(payload: ProfitLossPayload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "shidro";
  const sheet = workbook.addWorksheet(payload.granularity === "daily" ? "سود و زیان روزانه" : "سود و زیان ماهانه", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }],
  });
  sheet.columns = [
    { header: payload.granularity === "daily" ? "روز" : "ماه", key: "label", width: 22 },
    { header: "درآمد حمل (ریال)", key: "transportIncome", width: 22 },
    { header: "درآمد کمیسیون (ریال)", key: "commissionIncome", width: 24 },
    { header: "جمع درآمد (ریال)", key: "income", width: 22 },
    { header: "هزینه کرایه راننده (ریال)", key: "driverCost", width: 26 },
    { header: "سود / زیان (ریال)", key: "profit", width: 22 },
    { header: "تعداد بار تکمیل‌شده", key: "jobs", width: 20 },
  ];
  sheet.spliceRows(1, 0, [payload.granularity === "daily" ? "گزارش سود و زیان روزانه شیدرو" : "گزارش سود و زیان ماهانه شیدرو"]);
  sheet.mergeCells(1, 1, 1, 7);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(1).alignment = { horizontal: "center" };
  sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1220" } };
  sheet.getRow(2).alignment = { horizontal: "center", vertical: "middle" };

  for (const row of payload.rows) sheet.addRow(row);
  const total = sheet.addRow({ label: "جمع کل", ...payload.totals });
  total.font = { bold: true };
  total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F7EF" } };

  for (let i = 3; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    for (let c = 2; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.numFmt = c === 7 ? "#,##0" : "#,##0";
      cell.alignment = { horizontal: "center" };
    }
    const profit = row.getCell(6);
    const value = Number(profit.value ?? 0);
    profit.font = { bold: true, color: { argb: value < 0 ? "FFC62828" : "FF1B7F4B" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
