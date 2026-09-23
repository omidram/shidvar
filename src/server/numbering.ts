import { prisma } from "@/server/db";

export async function nextNumber(prefix: string) {
  const year = new Date().getUTCFullYear();
  const key = `${prefix}-${year}`;
  const row = await prisma.numberSequence.upsert({
    where: { key },
    create: { key, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(row.lastValue).padStart(6, "0")}`;
}
