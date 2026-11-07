export const ACTIVE_LOAD_STATUSES = [
  "DRIVER_SELECTED",
  "SUPPLIER_CONFIRMED",
  "SCHEDULED",
  "DRIVER_ASSIGNED",
  "ARRIVING_AT_PICKUP",
  "AT_PICKUP",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVING_AT_DESTINATION",
  "AT_DESTINATION",
  "UNLOADING",
  "DELIVERED",
  "PROOF_SUBMITTED",
  "DISPUTED",
] as const;

export function normalizeCity(city: string | null | undefined) {
  return (city ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type LoadCheck = {
  allowed: boolean;
  roobar: boolean;
  activeDestination: string | null;
  reason: string | null;
};

export function evaluateLoadAcceptance(
  activeDestinations: Array<string | null | undefined>,
  target: string | null | undefined,
  assignedByAdmin = false,
): LoadCheck {
  const active = activeDestinations.filter((city) => normalizeCity(city));
  if (!active.length) return { allowed: true, roobar: false, activeDestination: null, reason: null };
  const wanted = normalizeCity(target);
  const first = active[0] ?? null;
  const mismatch = active.find((city) => normalizeCity(city) !== wanted);
  if (wanted && !mismatch && assignedByAdmin) {
    return { allowed: true, roobar: true, activeDestination: first, reason: null };
  }
  if (wanted && !mismatch) {
    return {
      allowed: false,
      roobar: false,
      activeDestination: first,
      reason: "بار فعال دارید. بار همگانی دیگر قبول نمی‌شود؛ فقط روباری که مدیریت مخصوص شما تخصیص داده باشد.",
    };
  }
  return {
    allowed: false,
    roobar: false,
    activeDestination: mismatch ?? first,
    reason: `شما بار فعال به مقصد ${mismatch ?? first} دارید و تا پایان همان سفر بار دیگری قبول نمی‌کنید.`,
  };
}
