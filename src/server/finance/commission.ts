export type CommissionInput = {
  percent?: number | null;
  fixedAmount?: number | null;
  baseAmount: number;
};

export function calculateCommission(input: CommissionInput) {
  if (input.baseAmount < 0) {
    throw new Error("Base amount cannot be negative");
  }
  const percentPart = input.percent ? (input.baseAmount * Number(input.percent)) / 100 : 0;
  const fixed = input.fixedAmount ? Number(input.fixedAmount) : 0;
  return Math.round((percentPart + fixed) * 10000) / 10000;
}
