import { diffCalendarDaysIST, toNumber } from "./format";

export interface WeightLogInput {
  date: Date;
  weightG: number;
}

export interface MoltLogInput {
  date: Date;
  stage: string;
  weightAfterG: number | null;
}

export interface FeedLogInput {
  quantityG: number;
  costAtTime: number | string | { toString(): string };
}

export interface TreatmentLogInput {
  cost: number | string | { toString(): string };
}

export interface CrabMetricsInput {
  initialWeightG: number;
  finalWeightG: number | null;
  purchaseCost: number | string | { toString(): string };
  stockedDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  weightLogs: WeightLogInput[];
  moltLogs: MoltLogInput[];
  feedLogs: FeedLogInput[];
  treatmentLogs: TreatmentLogInput[];
  sale?: { totalAmount: number | string | { toString(): string } } | null;
}

export interface CrabMetrics {
  daysInSystem: number;
  latestWeightG: number;
  weightGainG: number;
  growthGPerDay: number;
  totalFeedG: number;
  feedCost: number;
  treatmentCost: number;
  purchaseCost: number;
  fcr: number | null;
  profit: number | null;
}

export function getLatestCrabWeightG(
  initialWeightG: number,
  finalWeightG: number | null,
  weightLogs: WeightLogInput[],
  moltLogs: MoltLogInput[]
): number {
  if (finalWeightG !== null && Number.isFinite(finalWeightG)) {
    return finalWeightG;
  }

  let latestDate = -Infinity;
  let latestWeight = initialWeightG;

  for (const w of weightLogs) {
    const ts = new Date(w.date).getTime();
    if (ts >= latestDate) {
      latestDate = ts;
      latestWeight = w.weightG;
    }
  }

  for (const m of moltLogs) {
    if (m.weightAfterG === null || !Number.isFinite(m.weightAfterG)) continue;
    const ts = new Date(m.date).getTime();
    if (ts > latestDate) {
      latestDate = ts;
      latestWeight = m.weightAfterG;
    }
  }

  return latestWeight;
}

export function computeCrabProfit(params: {
  status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  purchaseCost: number;
  feedCost: number;
  treatmentCost: number;
  saleAmount: number | null;
}): number | null {
  const totalCosts = params.purchaseCost + params.feedCost + params.treatmentCost;
  if (params.status === "SOLD" && params.saleAmount !== null) {
    return Math.round((params.saleAmount - totalCosts) * 100) / 100;
  }
  if (params.status === "DEAD") {
    return Math.round(-totalCosts * 100) / 100;
  }
  return null;
}

export function computeCrabMetrics(
  crab: CrabMetricsInput,
  referenceDate: Date = new Date()
): CrabMetrics {
  const endRef = crab.endDate ?? referenceDate;
  const daysInSystem = diffCalendarDaysIST(crab.stockedDate, endRef);
  const latestWeightG = getLatestCrabWeightG(
    crab.initialWeightG,
    crab.finalWeightG,
    crab.weightLogs,
    crab.moltLogs
  );
  const weightGainG = Math.round((latestWeightG - crab.initialWeightG) * 100) / 100;
  const growthGPerDay =
    daysInSystem > 0 ? Math.round((weightGainG / daysInSystem) * 100) / 100 : 0;

  const totalFeedG = crab.feedLogs.reduce((sum, f) => sum + f.quantityG, 0);
  const feedCost =
    Math.round(crab.feedLogs.reduce((sum, f) => sum + toNumber(f.costAtTime), 0) * 100) / 100;
  const treatmentCost =
    Math.round(crab.treatmentLogs.reduce((sum, t) => sum + toNumber(t.cost), 0) * 100) / 100;
  const purchaseCost = Math.round(toNumber(crab.purchaseCost) * 100) / 100;

  const fcr =
    weightGainG > 0 ? Math.round((totalFeedG / weightGainG) * 100) / 100 : null;

  const saleAmount = crab.sale ? toNumber(crab.sale.totalAmount) : null;
  const profit = computeCrabProfit({
    status: crab.status,
    purchaseCost,
    feedCost,
    treatmentCost,
    saleAmount,
  });

  return {
    daysInSystem,
    latestWeightG,
    weightGainG,
    growthGPerDay,
    totalFeedG,
    feedCost,
    treatmentCost,
    purchaseCost,
    fcr,
    profit,
  };
}

