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

export function databaseUnavailableError(error: unknown): AppError {
  const code = prismaErrorCode(error);
  if (code === "P1000") {
    return new AppError(
      "DATABASE_UNAVAILABLE",
      "Database rejected DATABASE_URL credentials. Check the user and password.",
      503,
    );
  }
  return new AppError(
    "DATABASE_UNAVAILABLE",
    "Database is not running. In this project run `npm run db:up`, then `npm run db:push` and `npm run db:seed`. Docker users can run `docker compose up -d postgres` instead.",
    503,
  );
}
