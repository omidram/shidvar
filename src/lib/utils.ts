import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { JALALI_MONTHS, isDateOnly, parseCalendarDate, toFaDigits, toJalali } from "@/lib/shamsi";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined, currency = "IRR", locale = "fa-IR") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = parseCalendarDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const { jy, jm, jd } = toJalali(date);
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  if (isDateOnly(value)) return formatDate(value);
  const date = parseCalendarDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}، ${toFaDigits(`${hours}:${minutes}`)}`;
}

export function formatNumber(value: number | string | null | undefined, locale = "fa-IR") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
