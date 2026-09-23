import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";
import { SYSTEM_ROLES } from "@/server/rbac/permissions";

export async function loadActor(userId: string, portalHint?: Actor["portal"]): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      memberships: { include: { company: true } },
      driverProfile: true,
    },
  });

  const permissions = new Set<string>();
  let isSuperAdmin = false;
  let isPlatformStaff = false;

  for (const assignment of user.userRoles) {
    if (assignment.role.code === "SUPER_ADMIN") isSuperAdmin = true;
    if (assignment.role.portal === "PLATFORM") isPlatformStaff = true;
    for (const rp of assignment.role.permissions) {
      permissions.add(rp.permission.code);
    }
    const bundled = SYSTEM_ROLES[assignment.role.code];
    if (bundled) {
      for (const p of bundled.permissions) permissions.add(p);
    }
  }

  for (const membership of user.memberships) {
    if (!membership.isOwner) continue;
    if (membership.company.type === "REQUESTER") {
      for (const p of SYSTEM_ROLES.REQUESTER_OWNER.permissions) permissions.add(p);
    }
    if (membership.company.type === "SUPPLIER") {
      for (const p of SYSTEM_ROLES.SUPPLIER_OWNER.permissions) permissions.add(p);
    }
    if (membership.company.type === "CARRIER") {
      for (const p of SYSTEM_ROLES.DRIVER.permissions) permissions.add(p);
    }
  }

  if (user.driverProfile) {
    for (const p of SYSTEM_ROLES.DRIVER.permissions) permissions.add(p);
  }

  return {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    locale: user.locale,
    permissions,
    isPlatformStaff,
    isSuperAdmin,
    memberships: user.memberships
      .filter((m) => m.status === "ACTIVE")
      .map((m) => ({
        companyId: m.companyId,
        companyType: m.company.type,
        companyStatus: m.company.status,
        isOwner: m.isOwner,
      })),
    driverProfile: user.driverProfile
      ? {
          id: user.driverProfile.id,
          status: user.driverProfile.status,
          carrierCompanyId: user.driverProfile.carrierCompanyId,
        }
      : null,
    portal: portalHint ?? null,
  };
}

export type UserWithAuth = Prisma.UserGetPayload<object>;
