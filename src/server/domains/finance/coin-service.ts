import type { CoinTxnKind, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import { getRule } from "@/server/settings/rules";
import type { Actor } from "@/server/rbac/actor";

type Tx = Prisma.TransactionClient;

export async function ensureCoinWallet(companyId: string) {
  const existing = await prisma.coinWallet.findUnique({ where: { companyId } });
  if (existing) return existing;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { type: true } });
  if (!company || company.type === "PLATFORM") throw Errors.notFound();
  const bonus = Math.max(0, Math.round(await getRule<number>("coins.signupBonus", 1000)));
  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.coinWallet.create({ data: { companyId, balance: bonus } });
      if (bonus > 0) {
        await tx.coinTransaction.create({
          data: { walletId: wallet.id, kind: "SIGNUP_BONUS", amount: bonus, balanceAfter: bonus, reason: "هدیه ثبت‌نام" },
        });
      }
      return wallet;
    });
  } catch {
    const raced = await prisma.coinWallet.findUnique({ where: { companyId } });
    if (raced) return raced;
    throw Errors.conflict("کیف اعتبار ساخته نشد");
  }
}

export async function moveCoins(
  input: {
    companyId: string;
    amount: number;
    kind: CoinTxnKind;
    reason?: string;
    refType?: string;
    refId?: string;
    actorId?: string;
  },
  tx?: Tx,
) {
  const amount = Math.trunc(input.amount);
  if (!amount) throw Errors.validation({ amount: ["مقدار اعتبار نمی‌تواند صفر باشد"] });
  const wallet = await ensureCoinWallet(input.companyId);
  const run = async (db: Tx) => {
    const updated = await db.coinWallet.updateMany({
      where: { id: wallet.id, ...(amount < 0 ? { balance: { gte: -amount } } : {}) },
      data: { balance: { increment: amount } },
    });
    if (updated.count !== 1) throw Errors.conflict("موجودی اعتبار کافی نیست");
    const fresh = await db.coinWallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return db.coinTransaction.create({
      data: {
        walletId: wallet.id,
        kind: input.kind,
        amount,
        balanceAfter: fresh.balance,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        createdById: input.actorId,
      },
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

function ownCompanyId(actor: Actor) {
  if (actor.driverProfile) return actor.driverProfile.carrierCompanyId;
  const membership =
    actor.memberships.find((m) => m.companyType === "REQUESTER" || m.companyType === "SUPPLIER") ??
    actor.memberships.find((m) => m.companyType !== "PLATFORM");
  if (!membership) throw Errors.notFound("کیف اعتبار برای این حساب تعریف نشده است");
  return membership.companyId;
}

async function walletView(companyId: string) {
  const wallet = await ensureCoinWallet(companyId);
  const transactions = await prisma.coinTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { companyId, balance: wallet.balance, transactions };
}

export async function getOwnCoins(actor: Actor) {
  return walletView(ownCompanyId(actor));
}

export async function getCompanyCoins(actor: Actor, companyId: string) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  return walletView(companyId);
}

export async function adjustCompanyCoins(actor: Actor, companyId: string, amount: number, reason: string) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const txn = await moveCoins({
    companyId,
    amount,
    kind: amount > 0 ? "ADMIN_GRANT" : "ADMIN_DEDUCT",
    reason,
    actorId: actor.userId,
  });
  await writeAudit({
    actor,
    action: "coins.adjusted",
    entityType: "Company",
    entityId: companyId,
    newValue: { amount, reason, balanceAfter: txn.balanceAfter },
  });
  return walletView(companyId);
}
