import { describe, expect, it } from "vitest";
import { isAllowedRequestOrigin, PRODUCTION_ORIGINS } from "./origin";

const local = ["http://localhost:5500", ...PRODUCTION_ORIGINS];

describe("isAllowedRequestOrigin", () => {
  it("allows the production site even when APP_URL is still local", () => {
    expect(isAllowedRequestOrigin("https://shidro.com", local)).toBe(true);
    expect(isAllowedRequestOrigin("https://www.shidro.com", local)).toBe(true);
  });

  it("allows the host the browser actually called", () => {
    expect(isAllowedRequestOrigin("https://shidro.com", ["http://127.0.0.1:3000", "shidro.com"])).toBe(true);
  });

  it("rejects a different site", () => {
    expect(isAllowedRequestOrigin("https://evil.example", local)).toBe(false);
    expect(isAllowedRequestOrigin("https://shidro.com.evil.example", local)).toBe(false);
  });

  it("allows requests that carry no Origin header", () => {
    expect(isAllowedRequestOrigin(null, local)).toBe(true);
  });
});
