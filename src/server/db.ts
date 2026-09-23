import * as Prisma from "@prisma/client";

const PrismaClient =
  Prisma.PrismaClient ??
  (Prisma as unknown as { default: { PrismaClient: typeof Prisma.PrismaClient } }).default.PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: InstanceType<typeof PrismaClient> };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
