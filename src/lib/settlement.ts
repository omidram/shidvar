export const SETTLEMENT_METHODS = ["ON_DELIVERY", "END_OF_LOADING_DAY", "AFTER_24H"] as const;

export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export const SETTLEMENT_FA: Record<SettlementMethod, string> = {
  ON_DELIVERY: "تسویه پای بار",
  END_OF_LOADING_DAY: "پایان روز بارگیری",
  AFTER_24H: "۲۴ ساعت بعد از تحویل بار",
};

export function settlementLabel(value?: string | null) {
  if (!value) return null;
  return SETTLEMENT_FA[value as SettlementMethod] ?? value;
}
