import { prisma } from "@/server/db";
import { DEFAULT_DRIVER_WEIGHTS, DEFAULT_SUPPLIER_WEIGHTS } from "@/server/matching/weights";

const DEFAULTS: Record<string, unknown> = {
  "matching.supplier.weights": DEFAULT_SUPPLIER_WEIGHTS,
  "matching.driver.weights": DEFAULT_DRIVER_WEIGHTS,
  "matching.minScoreToNotify": 40,
  "offers.maxValidityHours": 72,
  "offers.allowPartialQuantity": true,
  "requests.autoPublish": true,
  "jobs.opportunityExpiryMinutes": 30,
  "jobs.requireSupplierConfirm": true,
  "fulfillment.singleWinner": true,
  "commission.supplier.percent": 2.5,
  "commission.transport.percent": 5,
  "auth.maxFailedLogins": 5,
  "auth.lockoutMinutes": 15,
};

export async function getRule<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.businessRule.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value as T;
}

export async function getAllRules() {
  const rows = await prisma.businessRule.findMany();
  const map: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export { DEFAULTS as RULE_DEFAULTS };
