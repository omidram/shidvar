export type PortalIdentity = {
  isPlatformStaff: boolean;
  driverProfile: { id: string } | null;
  memberships: Array<{ companyType: string }>;
};

export function safeInternalPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

export function homePath(me: PortalIdentity) {
  if (me.isPlatformStaff) return "/admin/dashboard";
  if (me.driverProfile) return "/driver/dashboard";
  if (me.memberships.some((m) => m.companyType === "SUPPLIER")) return "/supplier/dashboard";
  if (me.memberships.some((m) => m.companyType === "REQUESTER")) return "/requester/dashboard";
  if (me.memberships.some((m) => m.companyType === "CARRIER")) return "/driver/dashboard";
  return "/login";
}
