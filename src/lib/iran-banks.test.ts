import { describe, expect, it } from "vitest";
import { isValidIban, normalizeIban } from "./iran-banks";

describe("iban", () => {
  it("accepts a spaced Iranian sheba", () => {
    expect(isValidIban("IR12 0120 0000 0000 5412 3987 61")).toBe(true);
    expect(normalizeIban("ir12-0120-0000000005412398761")).toBe("IR1201200000000005412398761");
  });

  it("rejects a short sheba", () => {
    expect(isValidIban("IR12")).toBe(false);
  });
});
