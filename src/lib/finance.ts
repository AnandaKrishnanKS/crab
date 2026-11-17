import { toNumber } from "./format";

export interface PeriodFinancialInput {
  sales: Array<{ totalAmount: number | string | { toString(): string } }>;
  crabPurchases: Array<{ purchaseCost: number | string | { toString(): string } }>;
  feedLogs: Array<{ costAtTime: number | string | { toString(): string } }>;
  treatmentLogs: Array<{ cost: number | string | { toString(): string } }>;
  mineralAdditions: Array<{ costAtTime: number | string | { toString(): string } }>;
  systemLogs: Array<{ cost: number | string | { toString(): string } | null }>;
  expenses: Array<{ amount: number | string | { toString(): string } }>;
}

export interface PeriodFinancialSummary {
  salesRevenue: number;
  crabPurchasesCost: number;
  feedCost: number;
  treatmentCost: number;
  mineralCost: number;
  maintenanceCost: number;
  operatingExpensesCost: number;
  totalExpenses: number;
  netProfit: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumMoney<T>(items: T[], getVal: (item: T) => number | string | { toString(): string } | null): number {
  let total = 0;
  for (const item of items) {
    const val = getVal(item);
    if (val !== null) total += toNumber(val);
  }
  return round2(total);
}

/**
 * Computes period revenue, non-overlapping expense categories, and net profit.
 * Avoids double counting: uses logged Crab.purchaseCost, FeedLog.costAtTime,
 * TreatmentLog.cost, MineralAddition.costAtTime, SystemLog.cost, and Expense.amount.
 */
export function computePeriodFinancials(
  input: PeriodFinancialInput
): PeriodFinancialSummary {
  const salesRevenue = sumMoney(input.sales, (s) => s.totalAmount);
  const crabPurchasesCost = sumMoney(input.crabPurchases, (c) => c.purchaseCost);
  const feedCost = sumMoney(input.feedLogs, (f) => f.costAtTime);
  const treatmentCost = sumMoney(input.treatmentLogs, (t) => t.cost);
  const mineralCost = sumMoney(input.mineralAdditions, (m) => m.costAtTime);
  const maintenanceCost = sumMoney(input.systemLogs, (l) => l.cost);
  const operatingExpensesCost = sumMoney(input.expenses, (e) => e.amount);

  const totalExpenses = round2(
    crabPurchasesCost +
      feedCost +
      treatmentCost +
      mineralCost +
      maintenanceCost +
      operatingExpensesCost
  );

  return {
    salesRevenue,
    crabPurchasesCost,
    feedCost,
    treatmentCost,
    mineralCost,
    maintenanceCost,
    operatingExpensesCost,
    totalExpenses,
    netProfit: round2(salesRevenue - totalExpenses),
  };
}

