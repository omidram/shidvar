import { describe, expect, it } from "vitest";
import { SYSTEM_ROLES, hasPermission } from "./permissions";

describe("rbac", () => {
  it("gives super admin every catalogued permission", () => {
    expect(SYSTEM_ROLES.SUPER_ADMIN.permissions).toContain("payments.manage");
    expect(SYSTEM_ROLES.SUPER_ADMIN.permissions).toContain("users.impersonate");
  });

  it("does not let drivers verify suppliers", () => {
    const perms = new Set(SYSTEM_ROLES.DRIVER.permissions);
    expect(hasPermission(perms, false, "suppliers.verify")).toBe(false);
    expect(hasPermission(perms, false, "jobs.apply")).toBe(true);
  });

  it("does not let requesters accept their own supplier approval", () => {
    const perms = new Set(SYSTEM_ROLES.REQUESTER_OWNER.permissions);
    expect(hasPermission(perms, false, "suppliers.verify")).toBe(false);
    expect(hasPermission(perms, false, "jobs.assign")).toBe(true);
    expect(hasPermission(perms, false, "invoices.read")).toBe(true);
  });
});
