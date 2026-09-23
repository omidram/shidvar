import { describe, expect, it } from "vitest";
import { calculateCommission } from "./commission";

describe("commission", () => {
  it("applies percent fees", () => {
    expect(calculateCommission({ percent: 2.5, baseAmount: 1000 })).toBe(25);
  });

  it("applies fixed plus percent", () => {
    expect(calculateCommission({ percent: 5, fixedAmount: 10, baseAmount: 200 })).toBe(20);
  });
});
