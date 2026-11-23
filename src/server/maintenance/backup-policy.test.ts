import { describe, expect, it } from "vitest";
import { backupIdFor, backupIsExpired, isBackupId, isNightlyWindow, tehranClock } from "./backup-policy";

describe("backup policy", () => {
  it("treats midnight in Tehran as the nightly window", () => {
    const midnight = new Date("2026-11-22T20:30:00.000Z");
    expect(tehranClock(midnight).date).toBe("2026-11-23");
    expect(tehranClock(midnight).hour).toBe(0);
    expect(isNightlyWindow(midnight)).toBe(true);
    expect(isNightlyWindow(new Date("2026-11-22T20:40:00.000Z"))).toBe(false);
  });

  it("keeps ten days and drops the older backup", () => {
    const now = Date.parse("2026-11-23T12:00:00.000Z");
    expect(backupIsExpired(now - 9 * 24 * 60 * 60 * 1000, now)).toBe(false);
    expect(backupIsExpired(now - 10 * 24 * 60 * 60 * 1000, now)).toBe(true);
  });

  it("builds a safe backup id", () => {
    const id = backupIdFor(new Date("2026-11-22T20:30:10.000Z"));
    expect(id).toBe("shidro-20261123-000010");
    expect(isBackupId(id)).toBe(true);
    expect(isBackupId("../shidro-20261123-000010")).toBe(false);
  });
});
