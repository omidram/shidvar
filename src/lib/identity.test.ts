import { describe, expect, it } from "vitest";
import { isIranianMobile, isValidNationalId, normalizeDigits, normalizeMobile } from "./identity";

describe("national ID", () => {
  it("accepts valid codes", () => {
    expect(isValidNationalId("0499370899")).toBe(true);
    expect(isValidNationalId("0790419904")).toBe(true);
  });

  it("rejects bad checksums, repeated digits, and wrong lengths", () => {
    expect(isValidNationalId("0499370898")).toBe(false);
    expect(isValidNationalId("1111111111")).toBe(false);
    expect(isValidNationalId("12345")).toBe(false);
  });

  it("reads Persian digits", () => {
    expect(isValidNationalId(normalizeDigits("۰۴۹۹۳۷۰۸۹۹"))).toBe(true);
  });
});

describe("mobile", () => {
  it("normalizes common formats", () => {
    expect(normalizeMobile("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(normalizeMobile("9121234567")).toBe("09121234567");
    expect(isIranianMobile("09121234567")).toBe(true);
    expect(isIranianMobile("0212345678")).toBe(false);
  });
});
