import { describe, expect, it } from "vitest";
import {
  mapZarinpalPaymentMessage,
  normalizeZarinpalBankName,
  parseZarinpalPaymentEnvelope,
  zarinpalStatusToBankLink,
} from "./zarinpal";

describe("zarinpal helpers", () => {
  it("strips the بانک prefix from issuing bank names", () => {
    expect(normalizeZarinpalBankName("بانک ملت", "نامشخص")).toBe("ملت");
    expect(normalizeZarinpalBankName(null, "پاسارگاد")).toBe("پاسارگاد");
  });

  it("maps panel statuses to local bank links", () => {
    expect(zarinpalStatusToBankLink("ACTIVE")).toBe("CONNECTED");
    expect(zarinpalStatusToBankLink("PENDING")).toBe("PENDING");
    expect(zarinpalStatusToBankLink("REJECTED")).toBe("FAILED");
  });

  it("maps payment codes to Persian messages", () => {
    expect(mapZarinpalPaymentMessage(100)).toBe("پرداخت موفق بود");
    expect(mapZarinpalPaymentMessage(101)).toBe("این پرداخت قبلاً تأیید شده است");
    expect(mapZarinpalPaymentMessage(-9)).toBe("شناسه مرچنت زرین‌پال نامعتبر است");
  });

  it("parses a successful request envelope", () => {
    const parsed = parseZarinpalPaymentEnvelope({
      data: { code: 100, message: "Success", authority: "A0000000000000000000000000001", fee: 0 },
      errors: [],
    });
    expect(parsed.authority).toBe("A0000000000000000000000000001");
    expect(parsed.code).toBe(100);
  });

  it("parses an object-shaped error envelope", () => {
    const parsed = parseZarinpalPaymentEnvelope({
      data: [],
      errors: { code: -9, message: "The merchant id is invalid" },
    });
    expect(parsed.code).toBe(-9);
    expect(parsed.message).toContain("مرچنت");
  });
});
