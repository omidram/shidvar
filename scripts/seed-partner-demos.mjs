import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  let created = 0;
  for (let index = 1; index <= 10; index += 1) {
    const username = `demo${index}`;
    const existing = await prisma.user.findFirst({ where: { email: username, deletedAt: null } });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(username, 12);
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          type: "PARTNER",
          status: "APPROVED",
          tradeName: `طرف قرارداد دمو ${index}`,
          legalName: `طرف قرارداد دمو ${index}`,
          verifiedAt: new Date(),
        },
      });
      const user = await tx.user.create({
        data: {
          email: username,
          passwordHash,
          firstName: "دمو",
          lastName: String(index),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      await tx.membership.create({
        data: { userId: user.id, companyId: company.id, isOwner: true, status: "ACTIVE" },
      });
    });
    created += 1;
  }
  console.log(`Partner demo accounts ready. Created ${created}. Login demo1 … demo10, password is the same as the username.`);
} finally {
  await prisma.$disconnect();
}
