export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  appUrl: process.env.APP_URL ?? "http://localhost:5500",
  appName: process.env.APP_NAME ?? "Shidvar",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  storageLocalPath: process.env.STORAGE_LOCAL_PATH ?? "./storage/private",
  defaultLocale: process.env.DEFAULT_LOCALE ?? "fa",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "IRR",
  defaultCountry: process.env.DEFAULT_COUNTRY ?? "IR",
  zarinpal: {
    merchantId: process.env.ZARINPAL_MERCHANT_ID ?? "",
    sandbox: process.env.ZARINPAL_SANDBOX !== "false",
    accessToken: process.env.ZARINPAL_ACCESS_TOKEN ?? "",
    terminalId: process.env.ZARINPAL_TERMINAL_ID ?? "",
  },
  smsOtp: {
    apiUrl: process.env.SMS_OTP_API_URL ?? "https://s.api.ir/api/sw1/SmsOTP",
    apiKey: process.env.SMS_OTP_API_KEY ?? "",
    template: Number(process.env.SMS_OTP_TEMPLATE ?? 1) || 1,
  },
};

export const COOKIES = {
  session: "sc_session",
  refresh: "sc_refresh",
  locale: "sc_locale",
  impersonation: "sc_impersonating",
} as const;
