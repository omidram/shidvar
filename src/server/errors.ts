export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  validation: (fields: Record<string, string[]>, message = "اطلاعات واردشده معتبر نیست") =>
    new AppError("VALIDATION_ERROR", message, 400, fields),
  unauthorized: (message = "برای ادامه باید وارد حساب شوید") =>
    new AppError("AUTH_REQUIRED", message, 401),
  forbidden: (message = "شما اجازهٔ انجام این کار را ندارید") =>
    new AppError("FORBIDDEN", message, 403),
  notFound: (message = "مورد درخواستی پیدا نشد") =>
    new AppError("NOT_FOUND", message, 404),
  conflict: (message = "این درخواست با وضعیت فعلی همخوانی ندارد") => new AppError("CONFLICT", message, 409),
  rateLimited: (message = "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید") =>
    new AppError("RATE_LIMITED", message, 429),
  invalidTransition: (from: string, to: string) =>
    new AppError("INVALID_STATE_TRANSITION", `انتقال از وضعیت ${from} به ${to} مجاز نیست`, 409),
  locked: (message = "حساب شما به‌دلیل ورود ناموفق چندباره موقتاً قفل شده است؛ چند دقیقه بعد دوباره امتحان کنید") =>
    new AppError("ACCOUNT_LOCKED", message, 423),
};
