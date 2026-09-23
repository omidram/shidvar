import { describe, expect, it } from "vitest";
import { databaseUnavailableError, isDatabaseUnavailable } from "./database-error";

describe("isDatabaseUnavailable", () => {
  it("maps Prisma P1001 connection failures", () => {
    expect(
      isDatabaseUnavailable({
        name: "PrismaClientInitializationError",
        errorCode: "P1001",
        message: "Can't reach database server at localhost:5433",
      }),
    ).toBe(true);
  });

  it("ignores ordinary application errors", () => {
    expect(isDatabaseUnavailable(new Error("Invalid credentials"))).toBe(false);
  });
});

describe("databaseUnavailableError", () => {
  it("returns 503 with an actionable message", () => {
    const mapped = databaseUnavailableError({ errorCode: "P1001" });
    expect(mapped.status).toBe(503);
    expect(mapped.code).toBe("DATABASE_UNAVAILABLE");
    expect(mapped.message).toMatch(/db:up/);
  });
});
