import { prisma } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";
import type { Prisma } from "@prisma/client";

export async function writeAudit(input: {
  actor: Actor | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actor ? "USER" : "SYSTEM",
      actorId: input.actor?.userId,
      actorRole: input.actor?.isSuperAdmin ? "SUPER_ADMIN" : input.actor?.portal ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
}

export async function recordStatusChange(input: {
  entityType: string;
  entityId: string;
  from: string | null;
  to: string;
  actorId?: string | null;
  note?: string;
}) {
  await prisma.statusHistory.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      fromStatus: input.from,
      toStatus: input.to,
      actorId: input.actorId ?? undefined,
      note: input.note,
    },
  });
}
