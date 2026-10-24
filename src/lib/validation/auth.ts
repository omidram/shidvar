import { z } from "zod";
import { isIranianMobile, isValidNationalId, normalizeDigits, normalizeMobile } from "@/lib/identity";

export function passwordPolicy(password: string) {
  const errors: string[] = [];
  if (password.length < 10) errors.push("Must be at least 10 characters");
  if (!/[A-Z]/.test(password)) errors.push("Must include an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must include a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Must include a number");
  return errors;
}

export const registerSchema = z.object({
  portal: z.enum(["REQUESTER", "DRIVER"]),
  phone: z
    .string()
    .transform(normalizeMobile)
    .refine(isIranianMobile, "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود"),
  nationalId: z
    .string()
    .transform(normalizeDigits)
    .refine(isValidNationalId, "کد ملی معتبر نیست"),
  password: z.string(),
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
  portal: z.enum(["PLATFORM", "REQUESTER", "SUPPLIER", "DRIVER", "CARRIER"]).optional(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string(),
});

export const verifyLoginOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().min(4).max(8),
  portal: z.enum(["PLATFORM", "REQUESTER", "SUPPLIER", "DRIVER", "CARRIER"]).optional(),
});

export const resendLoginOtpSchema = z.object({
  challengeId: z.string().uuid(),
});
