export const ACCOUNT_KIND_FA: Record<string, string> = {
  MAIN: "حساب اصلی",
  INCOME: "درآمد حمل",
  VEHICLE: "هزینه ماشین",
  TRAVEL: "رفت‌وآمد",
  CUSTOM: "حساب شخصی",
};

export const TXN_TYPE_FA: Record<string, string> = {
  TOPUP: "شارژ کیف پول",
  INCOME: "درآمد سفر",
  VEHICLE_EXPENSE: "هزینه ماشین",
  TRAVEL_EXPENSE: "هزینه رفت‌وآمد",
  WITHDRAW: "برداشت به بانک",
  TRANSFER_IN: "واریز بین حساب",
  TRANSFER_OUT: "انتقال بین حساب",
};

export const BANK_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار اتصال",
  CONNECTED: "متصل",
  FAILED: "ناموفق",
  DISCONNECTED: "قطع‌شده",
};

export const TXN_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار پرداخت",
  COMPLETED: "انجام‌شده",
  FAILED: "ناموفق",
};

export const EXPENSE_CATEGORIES = {
  VEHICLE: [
    { key: "fuel", title: "سوخت" },
    { key: "oil", title: "روغن و مواد مصرفی" },
    { key: "repair", title: "تعمیرات" },
    { key: "tire", title: "لاستیک" },
    { key: "insurance", title: "بیمه" },
    { key: "service", title: "سرویس دوره‌ای" },
    { key: "other_vehicle", title: "سایر هزینه ماشین" },
  ],
  TRAVEL: [
    { key: "toll", title: "عوارض جاده" },
    { key: "parking", title: "پارکینگ" },
    { key: "food", title: "خوراک مسیر" },
    { key: "lodging", title: "اقامت" },
    { key: "other_travel", title: "سایر رفت‌وآمد" },
  ],
} as const;

export function expenseCategoryFa(key?: string | null) {
  if (!key) return "—";
  for (const group of Object.values(EXPENSE_CATEGORIES)) {
    const hit = group.find((item) => item.key === key);
    if (hit) return hit.title;
  }
  return key;
}
