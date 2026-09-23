import { config } from "@/server/config";
import { Errors } from "@/server/errors";
import { logger } from "@/server/logger";

const REQUEST_TIMEOUT_MS = 15_000;

type SmsOtpResponse = {
  success?: boolean;
  data?: boolean;
  code?: number | string;
  message?: string | null;
};

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

export async function sendLoginSmsOtp(phone: string, code: string) {
  const mobile = normalizeIranMobile(phone);
  const apiKey = config.smsOtp.apiKey.trim();
  if (!apiKey) {
    if (config.isProd) {
      throw Errors.conflict("سرویس پیامک تنظیم نشده است. مقدار SMS_OTP_API_KEY را در فایل محیطی بگذارید.");
    }
    logger.warn("sms_otp_skipped", { reason: "missing_api_key", mobile: `${mobile.slice(0, 4)}***${mobile.slice(-3)}` });
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(config.smsOtp.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        code,
        mobile,
        template: config.smsOtp.template,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    logger.error("sms_otp_failed", { reason: error instanceof Error ? error.message : "network" });
    throw Errors.conflict("ارسال پیامک کد ورود ناموفق بود. دوباره تلاش کنید.");
  } finally {
    clearTimeout(timer);
  }

  let payload: SmsOtpResponse = {};
  try {
    payload = (await res.json()) as SmsOtpResponse;
  } catch {
    payload = {};
  }

  if (!res.ok || payload.success === false || payload.data === false) {
    logger.error("sms_otp_rejected", {
      status: res.status,
      code: payload.code,
      message: payload.message,
    });
    throw Errors.conflict(payload.message || "ارسال پیامک کد ورود ناموفق بود. دوباره تلاش کنید.");
  }

  logger.info("sms_otp_sent", { mobile: `${mobile.slice(0, 4)}***${mobile.slice(-3)}` });
  return true;
}
