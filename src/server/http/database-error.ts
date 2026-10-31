import { AppError } from "@/server/errors";

type UnknownError = {
  name?: string;
  code?: string;
  errorCode?: string;
  message?: string;
};

export function prismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as UnknownError;
  return err.errorCode ?? err.code;
}

export function isDatabaseUnavailable(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === "P1000" || code === "P1001" || code === "P1017" || code === "ECONNREFUSED") {
    return true;
  }
  if (!error || typeof error !== "object") return false;
  const err = error as UnknownError;
  if (err.name === "PrismaClientInitializationError") return true;
  const message = err.message ?? "";
  return /Can't reach database server|ECONNREFUSED|the database system is starting|Connection refused/i.test(
    message,
  );
}

export function isSchemaMismatch(error: unknown): boolean {
  return prismaErrorCode(error) === "P2022";
}

export function schemaMismatchError(): AppError {
  return new AppError(
    "SCHEMA_MISMATCH",
    "ساختار دیتابیس با نسخهٔ جدید هم‌خوان نیست. روی سرور دستور npm run db:ensure را اجرا کنید و سرویس را دوباره بالا بیاورید.",
    503,
  );
}

export function databaseUnavailableError(error: unknown): AppError {
  const code = prismaErrorCode(error);
  if (code === "P1000") {
    return new AppError(
      "DATABASE_UNAVAILABLE",
      "اطلاعات اتصال به دیتابیس رد شد؛ DATABASE_URL را بررسی کنید.",
      503,
    );
  }
  return new AppError(
    "DATABASE_UNAVAILABLE",
    "دیتابیس در دسترس نیست. اول npm run db:up، بعد npm run db:push و در صورت نیاز npm run db:seed را اجرا کنید.",
    503,
  );
}
