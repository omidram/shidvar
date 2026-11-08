import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit, recordStatusChange } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { assertPermission } from "@/server/rbac/actor";
import { revokeUserSessions } from "@/server/auth/session";
import type { CompanyStatus } from "@prisma/client";

async function peopleOf(companyId: string) {
  const rows = await prisma.membership.findMany({
    where: { companyId },
    include: { user: { include: { userRoles: { include: { role: { select: { portal: true } } } } } } },
  });
  return rows.filter((row) => !row.user.userRoles.some((item) => item.role.portal === "PLATFORM")).map((row) => row.userId);
}

async function applySuspension(companyId: string, userIds: string[], status: CompanyStatus, previous: CompanyStatus) {
  if (!userIds.length) return;
  if (status === "SUSPENDED" || status === "BLOCKED") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { status: status === "BLOCKED" ? "BLOCKED" : "SUSPENDED" },
    });
    await prisma.membership.updateMany({
      where: { companyId, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    await Promise.all(userIds.map((id) => revokeUserSessions(id)));
    return;
  }
  if (status === "APPROVED") {
    const clear: Array<"SUSPENDED" | "BLOCKED"> = ["SUSPENDED"];
    if (previous === "BLOCKED") clear.push("BLOCKED");
    await prisma.user.updateMany({
      where: { id: { in: userIds }, status: { in: clear } },
      data: { status: "ACTIVE" },
    });
    await prisma.membership.updateMany({
      where: { companyId, status: "SUSPENDED" },
      data: { status: "ACTIVE" },
    });
  }
}

export async function listPendingVerifications(actor: Actor) {
  assertPermission(actor, "companies.verify");
  const companies = await prisma.company.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] }, type: { not: "PLATFORM" } },
    orderBy: { createdAt: "asc" },
    include: { supplierProfile: true, carrierProfile: true, memberships: { include: { user: true } } },
  });
  const drivers = await prisma.driverProfile.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    include: { user: true, carrier: { include: { company: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { companies, drivers };
}

export async function moderateCompany(
  actor: Actor,
  companyId: string,
  status: Extract<CompanyStatus, "APPROVED" | "REJECTED" | "SUSPENDED" | "BLOCKED">,
  reason?: string,
) {
  if (status === "APPROVED") assertPermission(actor, "companies.verify");
  else if (status === "REJECTED") assertPermission(actor, "companies.reject");
  else assertPermission(actor, "companies.suspend");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { supplierProfile: true, carrierProfile: true },
  });
  if (!company) throw Errors.notFound();

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        status,
        verifiedAt: status === "APPROVED" ? new Date() : company.verifiedAt,
        verifiedById: actor.userId,
        rejectedReason: status === "REJECTED" ? reason : null,
        verificationNotes: reason,
      },
    });
    if (company.supplierProfile) {
      await tx.supplierProfile.update({ where: { companyId }, data: { status } });
    }
    if (company.carrierProfile) {
      await tx.carrierProfile.update({ where: { companyId }, data: { status } });
    }
  });

  await applySuspension(companyId, await peopleOf(companyId), status, company.status);
  await recordStatusChange({
    entityType: "Company",
    entityId: companyId,
    from: company.status,
    to: status,
    actorId: actor.userId,
    note: reason,
  });
  await writeAudit({
    actor,
    action: `company.${status.toLowerCase()}`,
    entityType: "Company",
    entityId: companyId,
    oldValue: { status: company.status },
    newValue: { status, reason },
  });
  return { id: companyId, status };
}

export async function moderateDriver(
  actor: Actor,
  driverId: string,
  status: Extract<CompanyStatus, "APPROVED" | "REJECTED" | "SUSPENDED" | "BLOCKED">,
  reason?: string,
) {
  if (status === "APPROVED") assertPermission(actor, "drivers.verify");
  else if (status === "REJECTED") assertPermission(actor, "drivers.reject");
  else assertPermission(actor, "drivers.update");

  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId } });
  if (!driver) throw Errors.notFound();

  await prisma.driverProfile.update({
    where: { id: driverId },
    data: { status },
  });
  await prisma.company.update({
    where: { id: driver.carrierCompanyId },
    data: { status, verifiedById: actor.userId, verifiedAt: status === "APPROVED" ? new Date() : undefined, rejectedReason: reason },
  });
  await prisma.carrierProfile.updateMany({
    where: { companyId: driver.carrierCompanyId },
    data: { status },
  });
  const people = new Set(await peopleOf(driver.carrierCompanyId));
  const platformRole = await prisma.userRole.findFirst({
    where: { userId: driver.userId, role: { portal: "PLATFORM" } },
    select: { id: true },
  });
  if (!platformRole) people.add(driver.userId);
  await applySuspension(driver.carrierCompanyId, [...people], status, driver.status);
  await writeAudit({
    actor,
    action: `driver.${status.toLowerCase()}`,
    entityType: "DriverProfile",
    entityId: driverId,
    oldValue: { status: driver.status },
    newValue: { status, reason },
  });
  return { id: driverId, status };
}
