import type { CompanyStatus, CompanyType, Portal, UserStatus } from "@prisma/client";
import { Errors } from "@/server/errors";
import { hasPermission } from "@/server/rbac/permissions";

export type ActorMembership = {
  companyId: string;
  companyType: CompanyType;
  companyStatus: CompanyStatus;
  isOwner: boolean;
};

export type Actor = {
  userId: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  locale: string;
  permissions: Set<string>;
  isPlatformStaff: boolean;
  isSuperAdmin: boolean;
  memberships: ActorMembership[];
  driverProfile: { id: string; status: CompanyStatus; carrierCompanyId: string } | null;
  portal: Portal | null;
};

export function actorCan(actor: Actor, permission: string) {
  return hasPermission(actor.permissions, actor.isSuperAdmin, permission);
}

export function assertPermission(actor: Actor, permission: string) {
  if (!actorCan(actor, permission)) {
    throw Errors.forbidden();
  }
}

export function companiesOfType(actor: Actor, type: CompanyType) {
  return actor.memberships.filter((m) => m.companyType === type).map((m) => m.companyId);
}

export function assertCompanyAccess(actor: Actor, companyId: string, permission?: string) {
  if (permission) assertPermission(actor, permission);
  if (actor.isPlatformStaff && (!permission || actorCan(actor, permission))) {
    if (!permission || actorCan(actor, permission)) return;
  }
  if (actor.isPlatformStaff) return;
  if (actor.memberships.some((m) => m.companyId === companyId)) return;
  throw Errors.notFound();
}

export function requireRequesterCompany(actor: Actor) {
  const id = companiesOfType(actor, "REQUESTER")[0];
  if (!id && !actor.isPlatformStaff) throw Errors.forbidden("Requester membership required");
  return id;
}

export function requireSupplierCompany(actor: Actor) {
  const id = companiesOfType(actor, "SUPPLIER")[0];
  if (!id && !actor.isPlatformStaff) throw Errors.forbidden("Supplier membership required");
  return id;
}

export function requireApprovedSupplier(actor: Actor) {
  const membership = actor.memberships.find((m) => m.companyType === "SUPPLIER");
  if (actor.isPlatformStaff) return membership?.companyId;
  if (!membership || membership.companyStatus !== "APPROVED") {
    throw Errors.forbidden("Supplier account is not approved");
  }
  return membership.companyId;
}

export function requireApprovedDriver(actor: Actor) {
  if (!actor.driverProfile) throw Errors.forbidden("Driver profile required");
  if (actor.driverProfile.status !== "APPROVED" && !actor.isPlatformStaff) {
    throw Errors.forbidden("Driver account is not approved");
  }
  return actor.driverProfile;
}
