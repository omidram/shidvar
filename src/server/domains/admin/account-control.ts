import { z } from "zod";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { hashPassword } from "@/server/auth/password";
import { passwordPolicy } from "@/lib/validation/auth";
import { revokeUserSessions } from "@/server/auth/session";
import { setSmsAccess, smsAccess } from "@/server/notify/sms-flags";

export const accountControlSchema = z.object({
  tradeName: z.string().trim().min(2, "نام نمایشی حداقل ۲ نویسه است").max(120).optional(),
  legalName: z.string().trim().min(2, "نام قانونی حداقل ۲ نویسه است").max(160).optional(),
  firstName: z.string().trim().min(1, "نام را بنویسید").max(80).optional(),
  lastName: z.string().trim().min(1, "نام خانوادگی را بنویسید").max(80).optional(),
  smsSend: z.boolean().optional(),
  smsReceive: z.boolean().optional(),
  newPassword: z.string().min(10, "رمز عبور باید حداقل ۱۰ نویسه باشد").max(80).optional(),
});

export type AccountControlInput = z.infer<typeof accountControlSchema>;

async function assertStaff(actor: Actor) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
}

async function ownerOfCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      memberships: {
        include: {
          user: { include: { userRoles: { include: { role: { select: { portal: true } } } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!company || company.type === "PLATFORM") throw Errors.notFound();
  const owner = company.memberships.find((row) => row.isOwner) ?? company.memberships[0];
  if (!owner) throw Errors.conflict("برای این صاحب بار کاربری ثبت نشده است");
  if (owner.user.userRoles.some((row) => row.role.portal === "PLATFORM")) throw Errors.forbidden();
  return { company, user: owner.user };
}

async function driverAccount(driverId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: {
      carrier: { include: { company: true } },
      user: { include: { userRoles: { include: { role: { select: { portal: true } } } } } },
    },
  });
  if (!driver) throw Errors.notFound();
  if (driver.user.userRoles.some((row) => row.role.portal === "PLATFORM")) throw Errors.forbidden();
  return driver;
}

function suspendedOf(userStatus: string, recordStatus: string) {
  return userStatus === "SUSPENDED" || userStatus === "BLOCKED" || recordStatus === "SUSPENDED" || recordStatus === "BLOCKED";
}

export async function getOwnerAccount(actor: Actor, companyId: string) {
  await assertStaff(actor);
  assertPermission(actor, "companies.read");
  const { company, user } = await ownerOfCompany(companyId);
  const sms = await smsAccess(user.id);
  return {
    kind: "owner" as const,
    userId: user.id,
    companyId: company.id,
    driverId: null,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    tradeName: company.tradeName,
    legalName: company.legalName,
    suspended: suspendedOf(user.status, company.status),
    smsSend: sms.send,
    smsReceive: sms.receive,
  };
}

export async function getDriverAccount(actor: Actor, driverId: string) {
  await assertStaff(actor);
  assertPermission(actor, "drivers.read");
  const driver = await driverAccount(driverId);
  const sms = await smsAccess(driver.userId);
  return {
    kind: "driver" as const,
    userId: driver.userId,
    companyId: driver.carrierCompanyId,
    driverId: driver.id,
    firstName: driver.user.firstName,
    lastName: driver.user.lastName,
    phone: driver.user.phone,
    tradeName: driver.carrier.company.tradeName,
    legalName: driver.carrier.company.legalName,
    suspended: suspendedOf(driver.user.status, driver.status),
    smsSend: sms.send,
    smsReceive: sms.receive,
  };
}

async function applyAccount(actor: Actor, userId: string, companyId: string, entityType: string, entityId: string, input: AccountControlInput) {
  if (input.newPassword) {
    assertPermission(actor, "users.update");
    const policy = passwordPolicy(input.newPassword);
    if (policy.length) throw Errors.validation({ password: policy }, policy[0]);
  }
  if (input.tradeName || input.legalName) assertPermission(actor, "companies.update");
  if (input.firstName || input.lastName) assertPermission(actor, "users.update");

  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : null;
  await prisma.$transaction(async (tx) => {
    if (input.tradeName || input.legalName) {
      await tx.company.update({
        where: { id: companyId },
        data: {
          ...(input.tradeName ? { tradeName: input.tradeName } : {}),
          ...(input.legalName ? { legalName: input.legalName } : {}),
        },
      });
    }
    if (input.firstName || input.lastName || passwordHash) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(passwordHash ? { passwordHash, failedLoginAttempts: 0, lockedUntil: null } : {}),
        },
      });
    }
  });
  if (input.smsSend !== undefined || input.smsReceive !== undefined) {
    await setSmsAccess(userId, { send: input.smsSend, receive: input.smsReceive });
  }
  if (passwordHash) await revokeUserSessions(userId);
  await writeAudit({
    actor,
    action: "account.admin_updated",
    entityType,
    entityId,
    newValue: {
      tradeName: input.tradeName,
      legalName: input.legalName,
      firstName: input.firstName,
      lastName: input.lastName,
      smsSend: input.smsSend,
      smsReceive: input.smsReceive,
      passwordSet: Boolean(passwordHash),
    },
  });
  return { ok: true };
}

export async function updateOwnerAccount(actor: Actor, companyId: string, input: AccountControlInput) {
  await assertStaff(actor);
  assertPermission(actor, "companies.update");
  const { company, user } = await ownerOfCompany(companyId);
  await applyAccount(actor, user.id, company.id, "Company", company.id, input);
  return getOwnerAccount(actor, companyId);
}

export async function updateDriverAccount(actor: Actor, driverId: string, input: AccountControlInput) {
  await assertStaff(actor);
  assertPermission(actor, "drivers.update");
  const driver = await driverAccount(driverId);
  await applyAccount(actor, driver.userId, driver.carrierCompanyId, "DriverProfile", driver.id, input);
  return getDriverAccount(actor, driverId);
}
