import type { Prisma, PrismaClient, WalletAccountKind, WalletTxnStatus, WalletTxnType } from "@prisma/client";
import { prisma } from "@/server/db";
import { config } from "@/server/config";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission, requireApprovedDriver } from "@/server/rbac/actor";
import { Errors } from "@/server/errors";
import { isValidIban, normalizeIban } from "@/lib/iran-banks";
import { ACCOUNT_KIND_FA, expenseCategoryFa } from "@/lib/wallet-labels";
import { addJalaliMonths, formatJalaliMonth, jalaliToIso, parseCalendarDate, toJalali } from "@/lib/shamsi";
import {
  addZarinpalShareBankAccount,
  createZarinpalInstantPayout,
  findZarinpalBankAccount,
  getZarinpalPublicStatus,
  requestZarinpalPayment,
  verifyZarinpalPayment,
  zarinpalStartPayUrl,
  zarinpalStatusToBankLink,
} from "@/server/finance/zarinpal";

const INCOME_JOB_STATUSES = ["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED"] as const;
const DEFAULT_ACCOUNTS: Array<{ name: string; kind: WalletAccountKind; isDefault?: boolean }> = [
  { name: "حساب اصلی", kind: "MAIN", isDefault: true },
  { name: "درآمد حمل", kind: "INCOME" },
  { name: "هزینه ماشین", kind: "VEHICLE" },
  { name: "رفت‌وآمد", kind: "TRAVEL" },
];

type Db = PrismaClient | Prisma.TransactionClient;

function num(value: unknown) {
  return Number(value ?? 0);
}

function money(value: unknown) {
  const amount = Math.round(num(value));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Errors.validation({ amount: ["مبلغ باید بزرگ‌تر از صفر باشد"] }, "مبلغ نامعتبر است");
  }
  return amount;
}

async function requireDriverWalletActor(actor: Actor) {
  assertPermission(actor, "wallet.manage");
  return requireApprovedDriver(actor);
}

async function loadWallet(db: Db, driverId: string) {
  const wallet = await db.driverWallet.findUnique({
    where: { driverId },
    include: {
      accounts: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      banks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!wallet) throw Errors.notFound("کیف پول پیدا نشد");
  return wallet;
}

export async function ensureWallet(driverId: string, db: Db = prisma) {
  const existing = await db.driverWallet.findUnique({ where: { driverId } });
  if (existing) {
    const accounts = await db.walletAccount.findMany({ where: { walletId: existing.id, archivedAt: null } });
    if (accounts.length) return existing;
    await db.walletAccount.createMany({
      data: DEFAULT_ACCOUNTS.map((row) => ({ walletId: existing.id, ...row })),
    });
    return existing;
  }
  return db.driverWallet.create({
    data: {
      driverId,
      currencyCode: "IRR",
      accounts: { create: DEFAULT_ACCOUNTS },
    },
  });
}

async function accountOfKind(db: Db, walletId: string, kind: WalletAccountKind) {
  const row = await db.walletAccount.findFirst({
    where: { walletId, kind, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (row) return row;
  return db.walletAccount.create({
    data: { walletId, kind, name: ACCOUNT_KIND_FA[kind] ?? kind, isDefault: kind === "MAIN" },
  });
}

async function resolveAccount(db: Db, walletId: string, accountId?: string | null, fallback?: WalletAccountKind) {
  if (accountId) {
    const row = await db.walletAccount.findFirst({ where: { id: accountId, walletId, archivedAt: null } });
    if (!row) throw Errors.validation({ accountId: ["حساب پیدا نشد"] });
    return row;
  }
  if (fallback) return accountOfKind(db, walletId, fallback);
  const def = await db.walletAccount.findFirst({
    where: { walletId, isDefault: true, archivedAt: null },
  });
  return def ?? accountOfKind(db, walletId, "MAIN");
}

async function applyTxn(
  db: Prisma.TransactionClient,
  input: {
    walletId: string;
    accountId: string;
    type: WalletTxnType;
    amount: number;
    title: string;
    note?: string;
    category?: string;
    bankAccountId?: string;
    groupId?: string;
    referenceType?: string;
    referenceId?: string;
    occurredAt?: Date;
    direction: "credit" | "debit";
    status?: WalletTxnStatus;
  },
) {
  const account = await db.walletAccount.findUnique({ where: { id: input.accountId } });
  if (!account || account.walletId !== input.walletId) throw Errors.notFound("حساب پیدا نشد");
  const status = input.status ?? "COMPLETED";
  if (status === "COMPLETED") {
    const current = num(account.balance);
    if (input.direction === "debit" && current < input.amount) {
      throw Errors.conflict("موجودی این حساب کافی نیست");
    }
    const next = input.direction === "credit" ? current + input.amount : current - input.amount;
    await db.walletAccount.update({
      where: { id: account.id },
      data: { balance: next },
    });
  } else if (input.direction === "debit") {
    const current = num(account.balance);
    if (current < input.amount) throw Errors.conflict("موجودی این حساب کافی نیست");
  }
  return db.walletTransaction.create({
    data: {
      walletId: input.walletId,
      accountId: input.accountId,
      bankAccountId: input.bankAccountId,
      type: input.type,
      status,
      amount: input.amount,
      currencyCode: "IRR",
      title: input.title,
      note: input.note,
      category: input.category,
      groupId: input.groupId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

async function completePendingCredit(
  db: Prisma.TransactionClient,
  txnId: string,
  note?: string,
) {
  const txn = await db.walletTransaction.findUnique({ where: { id: txnId } });
  if (!txn) throw Errors.notFound("تراکنش پیدا نشد");
  if (txn.status === "COMPLETED") return txn;
  if (txn.status !== "PENDING" && txn.status !== "FAILED") throw Errors.conflict("این تراکنش قابل تأیید نیست");
  const account = await db.walletAccount.findUnique({ where: { id: txn.accountId } });
  if (!account) throw Errors.notFound("حساب پیدا نشد");
  await db.walletAccount.update({
    where: { id: account.id },
    data: { balance: num(account.balance) + num(txn.amount) },
  });
  return db.walletTransaction.update({
    where: { id: txn.id },
    data: { status: "COMPLETED", note: note ?? txn.note },
  });
}

export async function syncJobIncome(driverId: string, db: Db = prisma) {
  const wallet = await ensureWallet(driverId, db);
  const jobs = await db.transportationJob.findMany({
    where: { assignedDriverId: driverId, status: { in: [...INCOME_JOB_STATUSES] } },
    select: {
      id: true,
      number: true,
      compensationAmount: true,
      createdAt: true,
      updatedAt: true,
      shipment: { select: { trackingNumber: true } },
    },
  });
  const income = await accountOfKind(db, wallet.id, "INCOME");
  for (const job of jobs) {
    const amount = Math.round(num(job.compensationAmount));
    if (amount <= 0) continue;
    const exists = await db.walletTransaction.findFirst({
      where: { walletId: wallet.id, referenceType: "JOB", referenceId: job.id },
    });
    if (exists) continue;
    const title = `کرایه ${job.shipment?.trackingNumber || job.number}`;
    if ("$transaction" in db) {
      await (db as PrismaClient).$transaction((tx) =>
        applyTxn(tx, {
          walletId: wallet.id,
          accountId: income.id,
          type: "INCOME",
          amount,
          title,
          referenceType: "JOB",
          referenceId: job.id,
          occurredAt: job.updatedAt ?? job.createdAt,
          direction: "credit",
        }),
      );
    } else {
      await applyTxn(db as Prisma.TransactionClient, {
        walletId: wallet.id,
        accountId: income.id,
        type: "INCOME",
        amount,
        title,
        referenceType: "JOB",
        referenceId: job.id,
        occurredAt: job.updatedAt ?? job.createdAt,
        direction: "credit",
      });
    }
  }
}

export async function creditJobIncome(driverId: string, jobId: string) {
  await ensureWallet(driverId);
  await syncJobIncome(driverId);
  return getWalletSnapshotByDriver(driverId);
}

function serializeAccount(row: { id: string; name: string; kind: string; balance: unknown; isDefault: boolean }) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    kindFa: ACCOUNT_KIND_FA[row.kind] ?? row.kind,
    balance: num(row.balance),
    isDefault: row.isDefault,
  };
}

function serializeBank(row: {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  cardLast4: string | null;
  zarinpalId?: string | null;
  zarinpalStatus?: string | null;
  status: string;
  connectedAt: Date | null;
}) {
  return {
    id: row.id,
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    iban: row.iban,
    cardLast4: row.cardLast4,
    zarinpalId: row.zarinpalId ?? null,
    zarinpalStatus: row.zarinpalStatus ?? null,
    status: row.status,
    connectedAt: row.connectedAt?.toISOString() ?? null,
  };
}

function serializeTxn(row: {
  id: string;
  type: string;
  status: string;
  amount: unknown;
  title: string;
  note: string | null;
  category: string | null;
  occurredAt: Date;
  account: { id: string; name: string; kind: string };
  bankAccount: { bankName: string } | null;
}) {
  const credit = ["TOPUP", "INCOME", "TRANSFER_IN"].includes(row.type);
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: num(row.amount),
    direction: credit ? "in" : "out",
    title: row.title,
    note: row.note,
    category: row.category,
    categoryFa: expenseCategoryFa(row.category),
    occurredAt: row.occurredAt.toISOString(),
    account: serializeAccount({ ...row.account, balance: 0, isDefault: false }),
    bankName: row.bankAccount?.bankName ?? null,
  };
}

function monthKey(date: Date) {
  const { jy, jm } = toJalali(date);
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

function buildReport(txns: Array<{ type: string; amount: unknown; category: string | null; occurredAt: Date }>) {
  const to = new Date();
  const now = toJalali(to);
  const start = addJalaliMonths(now.jy, now.jm, -5);
  const from = parseCalendarDate(jalaliToIso(start.jy, start.jm, 1));
  const series: Array<{ key: string; label: string; income: number; expense: number }> = [];
  let cursor = { jy: start.jy, jm: start.jm };
  const end = toJalali(to);
  while (cursor.jy < end.jy || (cursor.jy === end.jy && cursor.jm <= end.jm)) {
    const key = `${cursor.jy}-${String(cursor.jm).padStart(2, "0")}`;
    series.push({ key, label: formatJalaliMonth(cursor.jy, cursor.jm), income: 0, expense: 0 });
    cursor = addJalaliMonths(cursor.jy, cursor.jm, 1);
  }
  const categories = new Map<string, number>();
  let income = 0;
  let vehicle = 0;
  let travel = 0;
  let topup = 0;
  let withdraw = 0;
  for (const txn of txns) {
    if (txn.occurredAt < from) continue;
    const amount = num(txn.amount);
    const point = series.find((item) => item.key === monthKey(txn.occurredAt));
    if (txn.type === "INCOME" || txn.type === "TOPUP") {
      if (point) point.income += amount;
      if (txn.type === "INCOME") income += amount;
      else topup += amount;
    }
    if (txn.type === "VEHICLE_EXPENSE" || txn.type === "TRAVEL_EXPENSE") {
      if (point) point.expense += amount;
      if (txn.type === "VEHICLE_EXPENSE") vehicle += amount;
      else travel += amount;
      const key = txn.category || txn.type;
      categories.set(key, (categories.get(key) ?? 0) + amount);
    }
    if (txn.type === "WITHDRAW") withdraw += amount;
  }
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: { income, vehicle, travel, expense: vehicle + travel, topup, withdraw, net: income + topup - vehicle - travel - withdraw },
    series,
    categories: [...categories.entries()]
      .map(([key, amount]) => ({ key, title: expenseCategoryFa(key), amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function getWalletSnapshotByDriver(driverId: string) {
  await ensureWallet(driverId);
  await syncJobIncome(driverId);
  const wallet = await loadWallet(prisma, driverId);
  const [txns, reportRows] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      include: { account: true, bankAccount: true },
      orderBy: { occurredAt: "desc" },
      take: 80,
    }),
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, status: "COMPLETED" },
      select: { type: true, amount: true, category: true, occurredAt: true },
    }),
  ]);
  const accounts = wallet.accounts.map(serializeAccount);
  const balance = accounts.reduce((sum, row) => sum + row.balance, 0);
  return {
    id: wallet.id,
    currencyCode: "IRR",
    balance,
    accounts,
    banks: wallet.banks.map(serializeBank),
    transactions: txns.map(serializeTxn),
    report: buildReport(reportRows),
    zarinpal: getZarinpalPublicStatus(),
  };
}

export async function getWallet(actor: Actor) {
  assertPermission(actor, "wallet.read");
  const driver = requireApprovedDriver(actor);
  return getWalletSnapshotByDriver(driver.id);
}

export async function createWalletAccount(actor: Actor, input: { name: string; kind?: WalletAccountKind }) {
  const driver = await requireDriverWalletActor(actor);
  const name = input.name.trim();
  if (name.length < 2) throw Errors.validation({ name: ["نام حساب را بنویسید"] });
  const wallet = await ensureWallet(driver.id);
  const account = await prisma.walletAccount.create({
    data: { walletId: wallet.id, name, kind: input.kind ?? "CUSTOM" },
  });
  return serializeAccount(account);
}

export async function updateWalletAccount(actor: Actor, accountId: string, input: { name?: string; isDefault?: boolean }) {
  const driver = await requireDriverWalletActor(actor);
  const wallet = await ensureWallet(driver.id);
  const account = await prisma.walletAccount.findFirst({ where: { id: accountId, walletId: wallet.id } });
  if (!account) throw Errors.notFound("حساب پیدا نشد");
  if (input.isDefault) {
    await prisma.walletAccount.updateMany({ where: { walletId: wallet.id }, data: { isDefault: false } });
  }
  const updated = await prisma.walletAccount.update({
    where: { id: account.id },
    data: {
      name: input.name?.trim() || account.name,
      isDefault: input.isDefault ?? account.isDefault,
    },
  });
  return serializeAccount(updated);
}

export async function topUpWallet(
  actor: Actor,
  input: { amount: number; accountId?: string; bankAccountId?: string; method?: string },
) {
  const driver = await requireDriverWalletActor(actor);
  const amount = money(input.amount);
  if (amount < 50_000) throw Errors.validation({ amount: ["حداقل شارژ ۵۰٬۰۰۰ ریال است"] });
  const wallet = await ensureWallet(driver.id);
  const account = await resolveAccount(prisma, wallet.id, input.accountId, "MAIN");
  let bankAccountId: string | undefined;
  if (input.bankAccountId) {
    const bank = await prisma.driverBankAccount.findFirst({
      where: { id: input.bankAccountId, walletId: wallet.id },
    });
    if (!bank) throw Errors.notFound("حساب بانکی پیدا نشد");
    bankAccountId = bank.id;
  }
  const payment = await requestZarinpalPayment({
    amount,
    description: `شارژ کیف پول شیدوار — ${actor.firstName} ${actor.lastName}`.trim(),
    callbackUrl: `${config.appUrl.replace(/\/$/, "")}/driver/wallet/callback`,
    email: actor.email,
    mobile: actor.phone,
  });
  await prisma.$transaction((tx) =>
    applyTxn(tx, {
      walletId: wallet.id,
      accountId: account.id,
      type: "TOPUP",
      amount,
      title: "شارژ از زرین‌پال",
      note: "در انتظار پرداخت زرین‌پال",
      bankAccountId,
      referenceType: "ZARINPAL",
      referenceId: payment.authority,
      direction: "credit",
      status: "PENDING",
    }),
  );
  return {
    authority: payment.authority,
    redirectUrl: zarinpalStartPayUrl(payment.authority),
    sandbox: getZarinpalPublicStatus().sandbox,
  };
}

export async function verifyZarinpalTopup(
  input: { authority: string; status: string },
  actor?: Actor | null,
) {
  const authority = input.authority.trim();
  if (!authority) throw Errors.validation({ authority: ["شناسه پرداخت پیدا نشد"] });
  const txn = await prisma.walletTransaction.findFirst({
    where: { referenceType: "ZARINPAL", referenceId: authority },
    include: { wallet: true },
  });
  if (!txn) throw Errors.notFound("تراکنش شارژ پیدا نشد");
  if (actor?.driverProfile && txn.wallet.driverId !== actor.driverProfile.id) {
    throw Errors.forbidden("این پرداخت متعلق به حساب شما نیست");
  }
  if (txn.status === "COMPLETED") return getWalletSnapshotByDriver(txn.wallet.driverId);
  const gatewayOk = input.status.trim().toUpperCase() === "OK";
  if (!gatewayOk) {
    await prisma.walletTransaction.update({
      where: { id: txn.id },
      data: { status: "FAILED", note: "پرداخت زرین‌پال لغو شد یا ناموفق بود" },
    });
    throw Errors.conflict("پرداخت زرین‌پال انجام نشد");
  }
  try {
    const verified = await verifyZarinpalPayment({ amount: num(txn.amount), authority });
    const cardLast4 = verified.cardPan?.replace(/\D/g, "").slice(-4);
    const note = verified.refId
      ? `رسید زرین‌پال ${verified.refId}${cardLast4 ? ` · کارت ****${cardLast4}` : ""}`
      : "شارژ زرین‌پال تأیید شد";
    await prisma.$transaction((tx) => completePendingCredit(tx, txn.id, note));
    if (txn.bankAccountId && cardLast4) {
      await prisma.driverBankAccount.update({
        where: { id: txn.bankAccountId },
        data: { cardLast4 },
      });
    }
    return getWalletSnapshotByDriver(txn.wallet.driverId);
  } catch (error) {
    await prisma.walletTransaction.update({
      where: { id: txn.id },
      data: { status: "FAILED", note: error instanceof Error ? error.message : "تأیید پرداخت زرین‌پال ناموفق بود" },
    });
    throw error;
  }
}

export async function addWalletExpense(
  actor: Actor,
  input: {
    amount: number;
    kind: "VEHICLE" | "TRAVEL";
    category: string;
    title?: string;
    note?: string;
    accountId?: string;
    occurredAt?: string;
  },
) {
  const driver = await requireDriverWalletActor(actor);
  const amount = money(input.amount);
  const wallet = await ensureWallet(driver.id);
  const account = await resolveAccount(prisma, wallet.id, input.accountId, input.kind);
  const type: WalletTxnType = input.kind === "VEHICLE" ? "VEHICLE_EXPENSE" : "TRAVEL_EXPENSE";
  await prisma.$transaction((tx) =>
    applyTxn(tx, {
      walletId: wallet.id,
      accountId: account.id,
      type,
      amount,
      title: input.title?.trim() || expenseCategoryFa(input.category),
      note: input.note,
      category: input.category,
      occurredAt: input.occurredAt ? parseCalendarDate(input.occurredAt) : new Date(),
      direction: "debit",
    }),
  );
  return getWalletSnapshotByDriver(driver.id);
}

export async function transferWallet(actor: Actor, input: { fromAccountId: string; toAccountId: string; amount: number; note?: string }) {
  const driver = await requireDriverWalletActor(actor);
  const amount = money(input.amount);
  if (input.fromAccountId === input.toAccountId) {
    throw Errors.validation({ toAccountId: ["حساب مبدأ و مقصد یکی است"] });
  }
  const wallet = await ensureWallet(driver.id);
  const from = await resolveAccount(prisma, wallet.id, input.fromAccountId);
  const to = await resolveAccount(prisma, wallet.id, input.toAccountId);
  const groupId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: from.id,
      type: "TRANSFER_OUT",
      amount,
      title: `انتقال به ${to.name}`,
      note: input.note,
      groupId,
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: to.id,
      type: "TRANSFER_IN",
      amount,
      title: `دریافت از ${from.name}`,
      note: input.note,
      groupId,
      direction: "credit",
    });
  });
  return getWalletSnapshotByDriver(driver.id);
}

export async function withdrawWallet(actor: Actor, input: { amount: number; bankAccountId: string; accountId?: string }) {
  const driver = await requireDriverWalletActor(actor);
  const amount = money(input.amount);
  if (amount < 10_000) throw Errors.validation({ amount: ["حداقل برداشت ۱۰٬۰۰۰ ریال است"] });
  const wallet = await ensureWallet(driver.id);
  let bank = await prisma.driverBankAccount.findFirst({
    where: { id: input.bankAccountId, walletId: wallet.id },
  });
  if (!bank) throw Errors.notFound("حساب بانکی پیدا نشد");
  if (!bank.zarinpalId) {
    bank = await syncBankWithZarinpal(bank.id, wallet.id);
  }
  if (!bank.zarinpalId) throw Errors.conflict("این شبا هنوز در زرین‌پال ثبت نشده است");
  if (zarinpalStatusToBankLink(bank.zarinpalStatus) !== "CONNECTED") {
    throw Errors.conflict("شبا هنوز در زرین‌پال تأیید نشده است. وضعیت را از بخش حساب بانکی بررسی کنید.");
  }
  const account = await resolveAccount(prisma, wallet.id, input.accountId, "MAIN");
  const payout = await createZarinpalInstantPayout({ bankAccountId: bank.zarinpalId, amount });
  await prisma.$transaction((tx) =>
    applyTxn(tx, {
      walletId: wallet.id,
      accountId: account.id,
      type: "WITHDRAW",
      amount,
      title: `برداشت به ${bank.bankName}`,
      note: `برداشت آنی زرین‌پال · وضعیت ${payout.status}${payout.fee ? ` · کارمزد ${payout.fee}` : ""}`,
      bankAccountId: bank.id,
      referenceType: "ZARINPAL_PAYOUT",
      referenceId: payout.id,
      direction: "debit",
    }),
  );
  return getWalletSnapshotByDriver(driver.id);
}

async function persistZarinpalBank(
  walletId: string,
  input: {
    iban: string;
    bankName: string;
    accountHolder: string;
    cardLast4?: string | null;
    zarinpalId: string;
    zarinpalStatus: string;
  },
) {
  const link = zarinpalStatusToBankLink(input.zarinpalStatus);
  const data = {
    bankName: input.bankName,
    accountHolder: input.accountHolder,
    cardLast4: input.cardLast4 ?? undefined,
    zarinpalId: input.zarinpalId,
    zarinpalStatus: input.zarinpalStatus,
    status: link,
    connectedAt: link === "CONNECTED" ? new Date() : null,
  };
  const existing = await prisma.driverBankAccount.findFirst({ where: { walletId, iban: input.iban } });
  if (existing) {
    return prisma.driverBankAccount.update({ where: { id: existing.id }, data });
  }
  return prisma.driverBankAccount.create({
    data: { walletId, iban: input.iban, ...data },
  });
}

async function syncBankWithZarinpal(bankId: string, walletId: string) {
  const bank = await prisma.driverBankAccount.findFirst({ where: { id: bankId, walletId } });
  if (!bank) throw Errors.notFound("حساب بانکی پیدا نشد");
  const remote = bank.zarinpalId
    ? (await findZarinpalBankAccount(bank.iban)) ?? (await addZarinpalShareBankAccount(bank.iban))
    : await addZarinpalShareBankAccount(bank.iban);
  return persistZarinpalBank(walletId, {
    iban: bank.iban,
    bankName: remote.bankName || bank.bankName,
    accountHolder: remote.holderName || bank.accountHolder,
    cardLast4: bank.cardLast4,
    zarinpalId: remote.id,
    zarinpalStatus: remote.status,
  });
}

export async function addBankAccount(
  actor: Actor,
  input: { bankName?: string; accountHolder?: string; iban: string; cardLast4?: string },
) {
  const driver = await requireDriverWalletActor(actor);
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) throw Errors.validation({ iban: ["شبا باید با IR و ۲۴ رقم باشد"] });
  const fallbackHolder = `${actor.firstName} ${actor.lastName}`.trim() || "راننده";
  const holder = input.accountHolder?.trim() || fallbackHolder;
  const bankName = input.bankName?.trim() || "نامشخص";
  const cardLast4 = input.cardLast4?.replace(/\D/g, "").slice(-4) || null;
  const wallet = await ensureWallet(driver.id);
  const remote = await addZarinpalShareBankAccount(iban);
  const row = await persistZarinpalBank(wallet.id, {
    iban,
    bankName: remote.bankName || bankName,
    accountHolder: remote.holderName || holder,
    cardLast4,
    zarinpalId: remote.id,
    zarinpalStatus: remote.status,
  });
  return serializeBank(row);
}

export async function connectBankAccount(actor: Actor, bankId: string) {
  const driver = await requireDriverWalletActor(actor);
  const wallet = await ensureWallet(driver.id);
  return serializeBank(await syncBankWithZarinpal(bankId, wallet.id));
}

export async function disconnectBankAccount(actor: Actor, bankId: string) {
  const driver = await requireDriverWalletActor(actor);
  const wallet = await ensureWallet(driver.id);
  const bank = await prisma.driverBankAccount.findFirst({ where: { id: bankId, walletId: wallet.id } });
  if (!bank) throw Errors.notFound("حساب بانکی پیدا نشد");
  const updated = await prisma.driverBankAccount.update({
    where: { id: bank.id },
    data: { status: "DISCONNECTED", connectedAt: null },
  });
  return serializeBank(updated);
}

export async function seedWalletDemo(driverId: string) {
  await ensureWallet(driverId);
  await syncJobIncome(driverId);
  const wallet = await loadWallet(prisma, driverId);
  const hasManual = await prisma.walletTransaction.findFirst({
    where: { walletId: wallet.id, type: { in: ["TOPUP", "VEHICLE_EXPENSE", "TRAVEL_EXPENSE"] } },
  });
  if (hasManual) return;
  const main = wallet.accounts.find((a) => a.kind === "MAIN") ?? wallet.accounts[0];
  const vehicle = wallet.accounts.find((a) => a.kind === "VEHICLE") ?? main;
  const travel = wallet.accounts.find((a) => a.kind === "TRAVEL") ?? main;
  let mellat = wallet.banks.find((b) => b.bankName === "ملت");
  if (!mellat) {
    mellat = await prisma.driverBankAccount.create({
      data: {
        walletId: wallet.id,
        bankName: "ملت",
        accountHolder: "علی رضایی",
        iban: "IR120120000000005412398761",
        cardLast4: "4291",
        status: "CONNECTED",
        connectedAt: new Date(),
      },
    });
  }
  if (!wallet.banks.some((b) => b.bankName === "پاسارگاد")) {
    await prisma.driverBankAccount.create({
      data: {
        walletId: wallet.id,
        bankName: "پاسارگاد",
        accountHolder: "علی رضایی",
        iban: "IR570570000000009876543210",
        cardLast4: "8810",
        status: "PENDING",
      },
    });
  }
  await prisma.$transaction(async (tx) => {
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: main.id,
      type: "TOPUP",
      amount: 80_000_000,
      title: "شارژ از بانک ملت",
      bankAccountId: mellat!.id,
      occurredAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      direction: "credit",
    });
    const groupA = crypto.randomUUID();
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: main.id,
      type: "TRANSFER_OUT",
      amount: 15_000_000,
      title: `انتقال به ${vehicle.name}`,
      groupId: groupA,
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: vehicle.id,
      type: "TRANSFER_IN",
      amount: 15_000_000,
      title: `دریافت از ${main.name}`,
      groupId: groupA,
      direction: "credit",
    });
    const groupB = crypto.randomUUID();
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: main.id,
      type: "TRANSFER_OUT",
      amount: 5_000_000,
      title: `انتقال به ${travel.name}`,
      groupId: groupB,
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: travel.id,
      type: "TRANSFER_IN",
      amount: 5_000_000,
      title: `دریافت از ${main.name}`,
      groupId: groupB,
      direction: "credit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: vehicle.id,
      type: "VEHICLE_EXPENSE",
      amount: 4_200_000,
      title: "سوخت مسیر تهران",
      category: "fuel",
      occurredAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: vehicle.id,
      type: "VEHICLE_EXPENSE",
      amount: 8_500_000,
      title: "تعمیر ترمز",
      category: "repair",
      occurredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: travel.id,
      type: "TRAVEL_EXPENSE",
      amount: 650_000,
      title: "عوارض آزادراه",
      category: "toll",
      occurredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      direction: "debit",
    });
    await applyTxn(tx, {
      walletId: wallet.id,
      accountId: travel.id,
      type: "TRAVEL_EXPENSE",
      amount: 380_000,
      title: "خوراک مسیر",
      category: "food",
      occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      direction: "debit",
    });
  });
}
