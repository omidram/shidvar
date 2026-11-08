import { describe, expect, it } from "vitest";
import { loginOtpSmsText, normalizeIranMobile, serviceSmsAccepted, serviceSmsUrl, smsOtpAccepted, smsOtpBoundCode, webotpHost } from "./sms-otp";

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

describe("webotpHost", () => {
  it("keeps the public site hosts and drops local ones", () => {
    expect(webotpHost("shidro.com")).toBe("shidro.com");
    expect(webotpHost("WWW.SHIDRO.COM:443")).toBe("www.shidro.com");
    expect(webotpHost("https://shidro.com/login")).toBe("shidro.com");
    expect(webotpHost("localhost")).toBeNull();
    expect(webotpHost("127.0.0.1:5500")).toBeNull();
    expect(webotpHost("evil.com")).toBeNull();
    expect(webotpHost("shidro.com.evil.com")).toBeNull();
  });
});

describe("smsOtpBoundCode", () => {
  it("ends on the chrome origin line", () => {
    const code = smsOtpBoundCode("354399", "shidro.com");
    expect(code.endsWith("\n@shidro.com #354399")).toBe(true);
    expect(code.endsWith("\n")).toBe(false);
    const text = loginOtpSmsText("354399", "www.shidro.com");
    expect(text.split("\n").at(-1)).toBe("@www.shidro.com #354399");
  });
});

describe("serviceSmsUrl", () => {
  it("points at the sibling send endpoint", () => {
    expect(serviceSmsUrl("https://s.api.ir/api/sw1/SmsOTP")).toBe("https://s.api.ir/api/sw1/SendSms");
    expect(serviceSmsUrl("https://example.com/other")).toBeNull();
  });
});

describe("serviceSmsAccepted", () => {
  it("accepts a counted send and rejects a failed one", () => {
    expect(serviceSmsAccepted(200, { data: 1, success: true })).toBe(true);
    expect(serviceSmsAccepted(200, { data: true, success: true })).toBe(true);
    expect(serviceSmsAccepted(200, { data: 0, success: true })).toBe(false);
    expect(serviceSmsAccepted(200, { data: 1, success: false })).toBe(false);
    expect(serviceSmsAccepted(403, { data: 1, success: true })).toBe(false);
  });
});

describe("smsOtpAccepted", () => {
  it("accepts the api.ir payload where data is true", () => {
    expect(smsOtpAccepted(200, { data: true, success: false, code: 0, message: null })).toBe(true);
    expect(smsOtpAccepted(200, { data: true, success: true })).toBe(true);
  });

  it("rejects a failed send", () => {
    expect(smsOtpAccepted(200, { data: false, success: false, message: "موجودی کافی نیست" })).toBe(false);
    expect(smsOtpAccepted(401, { data: true, success: true })).toBe(false);
  });
});
