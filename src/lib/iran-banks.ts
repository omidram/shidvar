export const IRAN_BANKS = [
  "ملی",
  "ملت",
  "صادرات",
  "تجارت",
  "سپه",
  "کشاورزی",
  "پارسیان",
  "پاسارگاد",
  "سامان",
  "اقتصاد نوین",
  "رفاه کارگران",
  "مهر ایران",
  "رسالت",
  "شهر",
  "آینده",
  "دی",
  "گردشگری",
  "ایران‌زمین",
] as const;

export function normalizeIban(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIban(value: string) {
  return /^IR\d{24}$/.test(normalizeIban(value));
}
