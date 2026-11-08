import { config } from "@/server/config";
import { Errors } from "@/server/errors";
import { logger } from "@/server/logger";

const REQUEST_TIMEOUT_MS = 15_000;

type SmsOtpResponse = {
  success?: boolean;
  data?: boolean | number | null;
  code?: number | string;
  message?: string | null;
};

const WEBOTP_HOSTS = new Set(["shidro.com", "www.shidro.com"]);

/** Host Chrome will accept on the last SMS line. Local and unknown hosts are skipped. */
export function webotpHost(value: string | null | undefined) {
  if (!value) return null;
  let host = value.trim().toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  host = host.split(",")[0]?.trim().replace(/:\d+$/, "").replace(/\.$/, "") ?? "";
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return null;
  if (host === "localhost" || host.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  if (WEBOTP_HOSTS.has(host)) return host;
  try {
    const appHost = new URL(config.appUrl).hostname.toLowerCase();
    if (appHost === host && appHost.includes(".")) return host;
  } catch {
    return null;
  }
  return null;
}

/** Last line must be `@host #code` or Chrome closes the Allow sheet without the code. */
export function smsOtpBoundCode(code: string, host: string) {
  return `${code}\n\n@${host} #${code}`;
}

export function loginOtpSmsText(code: string, host: string) {
  return `کد ورود شیدرو: ${code}\n\n@${host} #${code}`;
}

export function serviceSmsUrl(apiUrl: string) {
  if (!/SmsOTP\/?$/i.test(apiUrl)) return null;
  return apiUrl.replace(/SmsOTP\/?$/i, "SendSms");
}

/** SendSms answers with data set to the number of accepted recipients. */
export function serviceSmsAccepted(status: number, payload: SmsOtpResponse) {
  if (status < 200 || status >= 300) return false;
  if (payload.success === false) return false;
  if (payload.data === true) return true;
  return typeof payload.data === "number" && payload.data > 0;
}

export function normalizeIranMobile(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  let national = digits;
  if (national.startsWith("0098")) national = national.slice(4);
  else if (national.startsWith("98")) national = national.slice(2);
  if (national.startsWith("9") && national.length === 10) national = `0${national}`;
  if (!/^09\d{9}$/.test(national)) {
    throw Errors.validation({ phone: ["شماره موبایل برای پیامک معتبر نیست"] }, "شماره موبایل برای پیامک معتبر نیست");
  }
  return national;
}

export function isSmsOtpConfigured() {
  return Boolean(config.smsOtp.apiKey.trim());
}

/** api.ir answers HTTP 200 with data:true even when success is false. */
export function smsOtpAccepted(status: number, payload: SmsOtpResponse) {
  if (status < 200 || status >= 300) return false;
  if (payload.data === true || payload.success === true) return true;
  return false;
}

async function postSms(url: string, body: unknown, timeoutMs: number): Promise<{ status: number; payload: SmsOtpResponse } | null> {
  const apiKey = config.smsOtp.apiKey.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload: SmsOtpResponse = {};
    try {
      payload = (await res.json()) as SmsOtpResponse;
    } catch {
      payload = {};
    }
    return { status: res.status, payload };
  } catch (error) {
    logger.warn("sms_otp_attempt_failed", { reason: error instanceof Error ? error.message : "network" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendLoginSmsOtp(phone: string, code: string, host?: string | null) {
  const mobile = normalizeIranMobile(phone);
  const digits = code.replace(/\D/g, "");
  const apiKey = config.smsOtp.apiKey.trim();
  const masked = `${mobile.slice(0, 4)}***${mobile.slice(-3)}`;
  if (!apiKey) {
    if (config.isProd) {
      throw Errors.conflict("سرویس پیامک تنظیم نشده است. مقدار SMS_OTP_API_KEY را در فایل محیطی بگذارید.");
    }
    logger.warn("sms_otp_skipped", { reason: "missing_api_key", mobile: masked });
    return false;
  }
  if (!/^\d{4,8}$/.test(digits)) {
    throw Errors.conflict("ارسال پیامک کد ورود ناموفق بود. دوباره تلاش کنید.");
  }

  const boundHost = webotpHost(host);
  if (boundHost) {
    // SmsOTP reports success even when it keeps only the digits, so Chrome's Allow
    // button has no @host line to read. A custom message must go out first.
    const serviceUrl = serviceSmsUrl(config.smsOtp.apiUrl);
    if (serviceUrl) {
      const service = await postSms(
        serviceUrl,
        { message: loginOtpSmsText(digits, boundHost), mobiles: [mobile] },
        8_000,
      );
      if (service && serviceSmsAccepted(service.status, service.payload)) {
        logger.info("sms_otp_sent", { mobile: masked, channel: "service" });
        return true;
      }
      logger.warn("sms_service_rejected", {
        status: service?.status ?? 0,
        code: service?.payload.code,
        message: service?.payload.message,
      });
    }

    const bound = await postSms(
      config.smsOtp.apiUrl,
      { code: smsOtpBoundCode(digits, boundHost), mobile, template: config.smsOtp.template },
      6_000,
    );
    if (bound && smsOtpAccepted(bound.status, bound.payload)) {
      logger.info("sms_otp_sent", { mobile: masked, channel: "otp-bound" });
      return true;
    }
  }

  const plain = await postSms(
    config.smsOtp.apiUrl,
    { code: digits, mobile, template: config.smsOtp.template },
    REQUEST_TIMEOUT_MS,
  );
  if (!plain) {
    logger.error("sms_otp_failed", { reason: "network" });
    throw Errors.conflict("ارسال پیامک کد ورود ناموفق بود. دوباره تلاش کنید.");
  }
  if (!smsOtpAccepted(plain.status, plain.payload)) {
    logger.error("sms_otp_rejected", {
      status: plain.status,
      code: plain.payload.code,
      message: plain.payload.message,
    });
    throw Errors.conflict(plain.payload.message || "ارسال پیامک کد ورود ناموفق بود. دوباره تلاش کنید.");
  }
  logger.info("sms_otp_sent", { mobile: masked, channel: "otp" });
  return true;
}
