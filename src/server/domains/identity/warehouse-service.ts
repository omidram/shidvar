import { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { randomToken } from "@/server/auth/tokens";
import { writeAudit } from "@/server/audit";

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, "نام انبار را وارد کنید").max(80),
  city: z.string().trim().min(2, "شهر را وارد کنید").max(60),
  region: z.string().trim().max(60).optional(),
  line1: z.string().trim().min(3, "نشانی انبار را وارد کنید").max(200),
  postalCode: z.string().trim().max(20).optional(),
  latitude: z.number().min(24).max(40.5, "موقعیت باید داخل ایران باشد"),
  longitude: z.number().min(43).max(64, "موقعیت باید داخل ایران باشد"),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

function ownerCompanyId(actor: Actor) {
  const membership = actor.memberships.find((m) => m.companyType === "REQUESTER" || m.companyType === "SUPPLIER");
  if (!membership) throw Errors.forbidden("فقط صاحب بار می‌تواند انبار ثبت کند");
  return membership.companyId;
}

export async function listOwnWarehouses(actor: Actor) {
  const companyIds = actor.isPlatformStaff ? undefined : actor.memberships.map((m) => m.companyId);
  return prisma.warehouse.findMany({
    where: { deletedAt: null, ...(companyIds ? { companyId: { in: companyIds } } : {}) },
    include: { address: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWarehouse(actor: Actor, input: WarehouseInput) {
  const companyId = ownerCompanyId(actor);
  const created = await prisma.$transaction(async (tx) => {
    const address = await tx.address.create({
      data: {
        companyId,
        label: input.name,
        line1: input.line1,
        city: input.city,
        region: input.region || input.city,
        postalCode: input.postalCode || null,
        latitude: input.latitude,
        longitude: input.longitude,
        isSensitive: false,
      },
    });
    return tx.warehouse.create({
      data: {
        companyId,
        code: `WH-${randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 6)}`,
        name: input.name,
        addressId: address.id,
      },
      include: { address: true },
    });
  });
  await writeAudit({ actor, action: "warehouse.created", entityType: "Warehouse", entityId: created.id, newValue: { name: input.name, city: input.city } });
  return created;
}

async function ownWarehouse(actor: Actor, id: string) {
  const companyId = ownerCompanyId(actor);
  const warehouse = await prisma.warehouse.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!warehouse) throw Errors.notFound("انبار پیدا نشد");
  return warehouse;
}

export async function updateWarehouse(actor: Actor, id: string, input: WarehouseInput) {
  const warehouse = await ownWarehouse(actor, id);
  await prisma.$transaction([
    prisma.address.update({
      where: { id: warehouse.addressId },
      data: {
        label: input.name,
        line1: input.line1,
        city: input.city,
        region: input.region || input.city,
        postalCode: input.postalCode || null,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    }),
    prisma.warehouse.update({ where: { id }, data: { name: input.name } }),
  ]);
  return prisma.warehouse.findUniqueOrThrow({ where: { id }, include: { address: true } });
}

export async function deleteWarehouse(actor: Actor, id: string) {
  await ownWarehouse(actor, id);
  await prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
  return { deleted: true };
}
