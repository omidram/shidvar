import { describe, expect, it } from "vitest";
import { evaluateLoadAcceptance } from "./load-rules";

describe("evaluateLoadAcceptance", () => {
  it("allows any load when the driver has none", () => {
    expect(evaluateLoadAcceptance([], "اصفهان")).toMatchObject({ allowed: true, roobar: false });
  });

  it("allows a roobar load with the same destination", () => {
    expect(evaluateLoadAcceptance(["اصفهان"], " اصفهان ")).toMatchObject({ allowed: true, roobar: true });
  });

  it("treats Arabic yeh and kaf as Persian", () => {
    expect(evaluateLoadAcceptance(["كرمان"], "کرمان")).toMatchObject({ allowed: true, roobar: true });
    expect(evaluateLoadAcceptance(["زاهدان"], "زاهدان")).toMatchObject({ allowed: true });
  });

  it("blocks a load with a different destination", () => {
    const check = evaluateLoadAcceptance(["اصفهان"], "مشهد");
    expect(check.allowed).toBe(false);
    expect(check.activeDestination).toBe("اصفهان");
  });

  it("blocks when one of several active loads goes elsewhere", () => {
    expect(evaluateLoadAcceptance(["اصفهان", "شیراز"], "اصفهان").allowed).toBe(false);
  });

  it("blocks when the new load has no destination", () => {
    expect(evaluateLoadAcceptance(["اصفهان"], null).allowed).toBe(false);
  });
});
