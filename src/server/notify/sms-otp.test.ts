import { describe, expect, it } from "vitest";
import { normalizeIranMobile } from "./sms-otp";

describe("normalizeIranMobile", () => {
  it("keeps a local 09 number", () => {
    expect(normalizeIranMobile("09128001101")).toBe("09128001101");
  });

  it("accepts spaced and plus-prefixed formats", () => {
    expect(normalizeIranMobile("+98 912 800 1101")).toBe("09128001101");
    expect(normalizeIranMobile("00989128001101")).toBe("09128001101");
    expect(normalizeIranMobile("9128001101")).toBe("09128001101");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizeIranMobile("02188001101")).toThrow();
    expect(() => normalizeIranMobile("8001101")).toThrow();
  });
});
