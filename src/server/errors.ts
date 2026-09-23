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
  validation: (fields: Record<string, string[]>, message = "Invalid request") =>
    new AppError("VALIDATION_ERROR", message, 400, fields),
  unauthorized: (message = "Authentication required") =>
    new AppError("AUTH_REQUIRED", message, 401),
  forbidden: (message = "You cannot perform this action") =>
    new AppError("FORBIDDEN", message, 403),
  notFound: (message = "Resource not found") =>
    new AppError("NOT_FOUND", message, 404),
  conflict: (message = "Conflict") => new AppError("CONFLICT", message, 409),
  rateLimited: (message = "Too many attempts. Try again later.") =>
    new AppError("RATE_LIMITED", message, 429),
  invalidTransition: (from: string, to: string) =>
    new AppError("INVALID_STATE_TRANSITION", `Cannot move from ${from} to ${to}`, 409),
  locked: (message = "Account is temporarily locked") =>
    new AppError("ACCOUNT_LOCKED", message, 423),
};
