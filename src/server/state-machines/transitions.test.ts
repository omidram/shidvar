import { describe, expect, it } from "vitest";
import {
  JOB_TRANSITIONS,
  OFFER_TRANSITIONS,
  REQUEST_TRANSITIONS,
  canTransition,
  detailsReleased,
} from "./transitions";

describe("request transitions", () => {
  it("allows draft to submitted", () => {
    expect(canTransition(REQUEST_TRANSITIONS, "DRAFT", "SUBMITTED")).toBe(true);
  });

  it("rejects skipping from draft to completed", () => {
    expect(canTransition(REQUEST_TRANSITIONS, "DRAFT", "COMPLETED")).toBe(false);
  });

  it("rejects leaving completed", () => {
    expect(canTransition(REQUEST_TRANSITIONS, "COMPLETED", "DRAFT")).toBe(false);
  });
});

describe("offer transitions", () => {
  it("does not allow clients to resurrect expired offers", () => {
    expect(canTransition(OFFER_TRANSITIONS, "EXPIRED", "SUBMITTED")).toBe(false);
  });
});

describe("job information release", () => {
  it("hides details before supplier confirmation", () => {
    expect(detailsReleased("OFFERED_TO_DRIVERS")).toBe(false);
    expect(detailsReleased("DRIVER_SELECTED")).toBe(false);
  });

  it("releases details from supplier confirmation onward", () => {
    expect(detailsReleased("SUPPLIER_CONFIRMED")).toBe(true);
    expect(detailsReleased("IN_TRANSIT")).toBe(true);
  });

  it("does not allow skipping loading", () => {
    expect(canTransition(JOB_TRANSITIONS, "AT_PICKUP", "IN_TRANSIT")).toBe(false);
    expect(canTransition(JOB_TRANSITIONS, "LOADING", "LOADED")).toBe(true);
  });
});
