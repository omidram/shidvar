import { config } from "@/server/config";
import { AppError, Errors } from "@/server/errors";

const GRAPHQL_URL = "https://next.zarinpal.com/api/v4/graphql/";
const REQUEST_TIMEOUT_MS = 20_000;

export type ZarinpalBankAccount = {
  id: string;
  iban: string;
  status: string;
  holderName: string | null;
  bankName: string | null;
};

export type ZarinpalPaymentRequest = {
  authority: string;
  fee: number;
};

export type ZarinpalPaymentVerify = {
  code: number;
  refId: number | null;
  cardPan: string | null;
  message: string;
};

export type ZarinpalPayout = {
  id: string;
  status: string;
  amount: number;
  fee: number;
};

export function getZarinpalPublicStatus() {
  return {
    sandbox: config.zarinpal.sandbox,
    paymentReady: Boolean(config.zarinpal.merchantId),
    bankReady: Boolean(config.zarinpal.accessToken),
    payoutReady: Boolean(config.zarinpal.accessToken && config.zarinpal.terminalId),
  };
}

export function requireZarinpalMerchant() {
  const merchantId = config.zarinpal.merchantId.trim();
  if (!merchantId) {
    throw Errors.conflict("شناسه مرچنت زرین‌پال تنظیم نشده است. مقدار ZARINPAL_MERCHANT_ID را در فایل محیطی بگذارید.");
  }
  return merchantId;
}

export function requireZarinpalAccessToken() {
  const token = config.zarinpal.accessToken.trim();
  if (!token) {
    throw Errors.conflict("توکن زرین‌پال تنظیم نشده است. مقدار ZARINPAL_ACCESS_TOKEN را در فایل محیطی بگذارید.");
  }
  return token;
}

export function requireZarinpalTerminal() {
  const terminalId = config.zarinpal.terminalId.trim();
  if (!terminalId) {
    throw Errors.conflict("شناسه ترمینال زرین‌پال تنظیم نشده است. مقدار ZARINPAL_TERMINAL_ID را در فایل محیطی بگذارید.");
  }
  return terminalId;
}

export function zarinpalPaymentUrl(kind: "request" | "verify") {
  const host = config.zarinpal.sandbox ? "https://sandbox.zarinpal.com" : "https://api.zarinpal.com";
  return `${host}/pg/v4/payment/${kind}.json`;
}

export function zarinpalStartPayUrl(authority: string) {
  const host = config.zarinpal.sandbox ? "https://sandbox.zarinpal.com" : "https://www.zarinpal.com";
  return `${host}/pg/StartPay/${authority}`;
}

export function normalizeZarinpalBankName(name?: string | null, fallback = "") {
  if (!name) return fallback;
  return name.replace(/^بانک\s+/u, "").trim() || fallback;
}

export function zarinpalStatusToBankLink(status?: string | null) {
  const value = (status ?? "").toUpperCase();
  if (value === "ACTIVE") return "CONNECTED" as const;
  if (value === "REJECTED" || value === "INACTIVE" || value === "FAILED") return "FAILED" as const;
  return "PENDING" as const;
}

export function mapZarinpalPaymentMessage(code: number, fallback?: string) {
  const messages: Record<number, string> = {
    100: "پرداخت موفق بود",
    101: "این پرداخت قبلاً تأیید شده است",
    [-9]: "شناسه مرچنت زرین‌پال نامعتبر است",
    [-10]: "مبلغ پرداخت نامعتبر است",
    [-11]: "مبلغ از حداقل مجاز زرین‌پال کمتر است",
    [-12]: "درگاه پرداخت با مرچنت هم‌خوان نیست",
    [-21]: "پرداخت پیدا نشد",
    [-22]: "تراکنش ناموفق بود",
    [-33]: "مبلغ تأیید با مبلغ درخواست یکی نیست",
    [-50]: "مبلغ تأیید با مبلغ پرداخت‌شده یکی نیست",
    [-51]: "پرداخت ناموفق بود",
    [-54]: "شناسه مرجع نامعتبر است",
  };
  return messages[code] ?? fallback ?? `خطای زرین‌پال (${code})`;
}

type PaymentEnvelope = {
  data?: {
    code?: number;
    message?: string;
    authority?: string;
    fee?: number;
    ref_id?: number;
    card_pan?: string;
  } | unknown[];
  errors?: { code?: number; message?: string } | Array<{ code?: number; message?: string }>;
};

export function parseZarinpalPaymentEnvelope(json: PaymentEnvelope) {
  const error = Array.isArray(json.errors) ? json.errors[0] : json.errors;
  const data = Array.isArray(json.data) ? undefined : json.data;
  const code = data?.code ?? error?.code ?? 0;
  return {
    code,
    message: mapZarinpalPaymentMessage(code, data?.message ?? error?.message),
    authority: data?.authority,
    fee: data?.fee ?? 0,
    refId: data?.ref_id ?? null,
    cardPan: data?.card_pan ?? null,
  };
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as PaymentEnvelope | { data?: unknown; errors?: Array<{ message?: string }> } | null;
    if (!json) throw Errors.conflict("پاسخ زرین‌پال خوانده نشد");
    return { ok: res.ok, json };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Errors.conflict("زرین‌پال پاسخ نداد. دوباره تلاش کنید.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestZarinpalPayment(input: {
  amount: number;
  description: string;
  callbackUrl: string;
  email?: string | null;
  mobile?: string | null;
}): Promise<ZarinpalPaymentRequest> {
  const merchantId = requireZarinpalMerchant();
  const { json } = await postJson(zarinpalPaymentUrl("request"), {
    merchant_id: merchantId,
    amount: input.amount,
    description: input.description,
    callback_url: input.callbackUrl,
    metadata: {
      email: input.email || undefined,
      mobile: input.mobile || undefined,
    },
  });
  const parsed = parseZarinpalPaymentEnvelope(json as PaymentEnvelope);
  if (parsed.code !== 100 || !parsed.authority) {
    throw Errors.conflict(parsed.message);
  }
  return { authority: parsed.authority, fee: parsed.fee };
}

export async function verifyZarinpalPayment(input: { amount: number; authority: string }): Promise<ZarinpalPaymentVerify> {
  const merchantId = requireZarinpalMerchant();
  const { json } = await postJson(zarinpalPaymentUrl("verify"), {
    merchant_id: merchantId,
    amount: input.amount,
    authority: input.authority,
  });
  const parsed = parseZarinpalPaymentEnvelope(json as PaymentEnvelope);
  if (parsed.code !== 100 && parsed.code !== 101) {
    throw Errors.conflict(parsed.message);
  }
  return {
    code: parsed.code,
    refId: parsed.refId,
    cardPan: parsed.cardPan,
    message: parsed.message,
  };
}

async function zarinpalGraphql<T>(query: string, variables: Record<string, unknown>) {
  const token = requireZarinpalAccessToken();
  const { ok, json } = await postJson(GRAPHQL_URL, { query, variables }, { Authorization: `Bearer ${token}` });
  const payload = json as { data?: T; errors?: Array<{ message?: string }> };
  const message = payload.errors?.[0]?.message;
  if (!ok || message) {
    throw Errors.conflict(message ? `خطای زرین‌پال: ${message}` : "درخواست GraphQL زرین‌پال ناموفق بود");
  }
  if (!payload.data) throw Errors.conflict("پاسخ GraphQL زرین‌پال خالی بود");
  return payload.data;
}

function mapGraphqlBank(row: {
  id?: string;
  iban?: string;
  status?: string;
  holder_name?: string | null;
  issuing_bank?: { name?: string | null } | null;
}): ZarinpalBankAccount | null {
  if (!row.id || !row.iban) return null;
  return {
    id: String(row.id),
    iban: row.iban,
    status: row.status ?? "PENDING",
    holderName: row.holder_name ?? null,
    bankName: normalizeZarinpalBankName(row.issuing_bank?.name),
  };
}

export async function listZarinpalBankAccounts(): Promise<ZarinpalBankAccount[]> {
  const data = await zarinpalGraphql<{
    BankAccounts?: Array<{
      id?: string;
      iban?: string;
      status?: string;
      holder_name?: string | null;
      issuing_bank?: { name?: string | null } | null;
    }>;
  }>(
    `query BankAccounts {
      BankAccounts {
        id
        iban
        status
        holder_name
        issuing_bank { name slug }
      }
    }`,
    {},
  );
  return (data.BankAccounts ?? []).map(mapGraphqlBank).filter((row): row is ZarinpalBankAccount => Boolean(row));
}

export async function addZarinpalShareBankAccount(iban: string): Promise<ZarinpalBankAccount> {
  try {
    const data = await zarinpalGraphql<{
      BankAccountAdd?: {
        id?: string;
        iban?: string;
        status?: string;
        holder_name?: string | null;
        issuing_bank?: { name?: string | null } | null;
      };
    }>(
      `mutation BankAccountAdd($iban: IBAN!, $is_legal: Boolean!, $type: BankAccountTypeEnum!) {
        BankAccountAdd(iban: $iban, is_legal: $is_legal, type: $type) {
          id
          iban
          status
          holder_name
          issuing_bank { name slug }
        }
      }`,
      { iban, is_legal: false, type: "SHARE" },
    );
    const row = mapGraphqlBank(data.BankAccountAdd ?? {});
    if (!row) throw Errors.conflict("زرین‌پال حساب بانکی را برنگرداند");
    return row;
  } catch (error) {
    if (error instanceof AppError && error.message.includes("ZARINPAL_ACCESS_TOKEN")) throw error;
    const existing = (await listZarinpalBankAccounts()).find((row) => row.iban.replace(/[\s-]/g, "").toUpperCase() === iban);
    if (existing) return existing;
    throw error;
  }
}

export async function findZarinpalBankAccount(iban: string) {
  const normalized = iban.replace(/[\s-]/g, "").toUpperCase();
  return (await listZarinpalBankAccounts()).find((row) => row.iban.replace(/[\s-]/g, "").toUpperCase() === normalized) ?? null;
}

export async function createZarinpalInstantPayout(input: {
  bankAccountId: string;
  amount: number;
}): Promise<ZarinpalPayout> {
  const terminalId = requireZarinpalTerminal();
  const data = await zarinpalGraphql<{
    InstantPayoutAdd?: { id?: string; status?: string; amount?: number; fee?: number };
  }>(
    `mutation InstantPayoutAdd($terminal_id: ID!, $bank_account_id: ID!, $amount: BigInteger!) {
      InstantPayoutAdd(terminal_id: $terminal_id, bank_account_id: $bank_account_id, amount: $amount) {
        id
        status
        amount
        fee
      }
    }`,
    { terminal_id: terminalId, bank_account_id: input.bankAccountId, amount: input.amount },
  );
  const row = data.InstantPayoutAdd;
  if (!row?.id) throw Errors.conflict("زرین‌پال درخواست برداشت را ثبت نکرد");
  return {
    id: String(row.id),
    status: row.status ?? "PENDING",
    amount: Number(row.amount ?? input.amount),
    fee: Number(row.fee ?? 0),
  };
}
