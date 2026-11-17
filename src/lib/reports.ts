import { computeCrabMetrics, type CrabMetricsInput } from "./crab-metrics";
import { computePeriodFinancials, type PeriodFinancialSummary } from "./finance";
import { formatDateIN, toISTDateString, toNumber } from "./format";
import { buildTrayHistoryRows, type TrayAssignmentHistoryInput } from "./tray";

export function escapeCsvCell(
  val: string | number | boolean | null | undefined
): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\r\n");
}

export interface MonthlyPnlRow extends PeriodFinancialSummary {
  ymKey: string;
  monthLabel: string;
}

export function buildMonthlyPnlSeries(input: {
  sales: Array<{ date: Date; totalAmount: number | string | { toString(): string } }>;
  crabPurchases: Array<{ stockedDate: Date; purchaseCost: number | string | { toString(): string } }>;
  feedLogs: Array<{ dateTime: Date; costAtTime: number | string | { toString(): string } }>;
  treatmentLogs: Array<{ date: Date; cost: number | string | { toString(): string } }>;
  mineralAdditions: Array<{ dateTime: Date; costAtTime: number | string | { toString(): string } }>;
  systemLogs: Array<{ date: Date; cost: number | string | { toString(): string } | null }>;
  expenses: Array<{ date: Date; amount: number | string | { toString(): string } }>;
}): MonthlyPnlRow[] {
  const buckets = new Map<
    string,
    {
      sales: typeof input.sales;
      crabPurchases: typeof input.crabPurchases;
      feedLogs: typeof input.feedLogs;
      treatmentLogs: typeof input.treatmentLogs;
      mineralAdditions: typeof input.mineralAdditions;
      systemLogs: typeof input.systemLogs;
      expenses: typeof input.expenses;
    }
  >();

  const ensure = (d: Date) => {
    const ym = toISTDateString(d).slice(0, 7);
    let b = buckets.get(ym);
    if (!b) {
      b = {
        sales: [],
        crabPurchases: [],
        feedLogs: [],
        treatmentLogs: [],
        mineralAdditions: [],
        systemLogs: [],
        expenses: [],
      };
      buckets.set(ym, b);
    }
    return b;
  };

  for (const x of input.sales) ensure(x.date).sales.push(x);
  for (const x of input.crabPurchases) ensure(x.stockedDate).crabPurchases.push(x);
  for (const x of input.feedLogs) ensure(x.dateTime).feedLogs.push(x);
  for (const x of input.treatmentLogs) ensure(x.date).treatmentLogs.push(x);
  for (const x of input.mineralAdditions) ensure(x.dateTime).mineralAdditions.push(x);
  for (const x of input.systemLogs) ensure(x.date).systemLogs.push(x);
  for (const x of input.expenses) ensure(x.date).expenses.push(x);

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ymKey, b]) => {
      const [y, m] = ymKey.split("-");
      return {
        ymKey,
        monthLabel: `${m}/${y}`,
        ...computePeriodFinancials(b),
      };
    });
}

export interface ReportCrabInput extends CrabMetricsInput {
  id: string;
  code: string;
  batchId: string;
  batchLetter: string;
  sex: "MALE" | "FEMALE";
}

export interface CrabPnlRow {
  id: string;
  code: string;
  batchLetter: string;
  status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  daysInSystem: number;
  initialWeightG: number;
  latestWeightG: number;
  weightGainG: number;
  growthGPerDay: number;
  totalFeedG: number;
  fcr: number | null;
  purchaseCost: number;
  feedCost: number;
  treatmentCost: number;
  saleAmount: number | null;
  profit: number | null;
}

export function buildCrabPnlRows(
  crabs: ReportCrabInput[],
  now: Date = new Date()
): CrabPnlRow[] {
  return crabs.map((c) => {
    const m = computeCrabMetrics(c, now);
    return {
      id: c.id,
      code: c.code,
      batchLetter: c.batchLetter,
      status: c.status,
      daysInSystem: m.daysInSystem,
      initialWeightG: c.initialWeightG,
      latestWeightG: m.latestWeightG,
      weightGainG: m.weightGainG,
      growthGPerDay: m.growthGPerDay,
      totalFeedG: m.totalFeedG,
      fcr: m.fcr,
      purchaseCost: m.purchaseCost,
      feedCost: m.feedCost,
      treatmentCost: m.treatmentCost,
      saleAmount: c.sale ? toNumber(c.sale.totalAmount) : null,
      profit: m.profit,
    };
  });
}

export interface BatchPnlInput {
  id: string;
  letter: string;
  purchaseDate: Date;
  supplierName: string;
  crabs: ReportCrabInput[];
}

export interface BatchPnlRow {
  id: string;
  letter: string;
  purchaseDateLabel: string;
  supplierName: string;
  crabCount: number;
  soldCount: number;
  deadCount: number;
  openCount: number;
  totalPurchaseCost: number;
  totalFeedCost: number;
  totalTreatmentCost: number;
  totalRevenue: number;
  netDirectPnl: number;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildBatchPnlRows(
  batches: BatchPnlInput[],
  now: Date = new Date()
): BatchPnlRow[] {
  return batches.map((b) => {
    const crabRows = buildCrabPnlRows(b.crabs, now);
    const totalPurchaseCost = r2(
      crabRows.reduce((s, r) => s + r.purchaseCost, 0)
    );
    const totalFeedCost = r2(crabRows.reduce((s, r) => s + r.feedCost, 0));
    const totalTreatmentCost = r2(
      crabRows.reduce((s, r) => s + r.treatmentCost, 0)
    );
    const totalRevenue = r2(
      crabRows.reduce((s, r) => s + (r.saleAmount ?? 0), 0)
    );
    return {
      id: b.id,
      letter: b.letter,
      purchaseDateLabel: formatDateIN(b.purchaseDate),
      supplierName: b.supplierName,
      crabCount: crabRows.length,
      soldCount: crabRows.filter((r) => r.status === "SOLD").length,
      deadCount: crabRows.filter((r) => r.status === "DEAD").length,
      openCount: crabRows.filter(
        (r) => r.status === "ACTIVE" || r.status === "SICK"
      ).length,
      totalPurchaseCost,
      totalFeedCost,
      totalTreatmentCost,
      totalRevenue,
      netDirectPnl: r2(
        totalRevenue - (totalPurchaseCost + totalFeedCost + totalTreatmentCost)
      ),
    };
  });
}

export interface TraySummaryRow {
  id: string;
  trayNumber: string;
  active: boolean;
  isTreatmentTray: boolean;
  currentCrabCode: string | null;
  staysCount: number;
  soldCount: number;
  deadCount: number;
  realizedProfit: number;
}

export function buildTraySummaryRows(
  trays: Array<{
    id: string;
    number: string;
    active: boolean;
    isTreatmentTray: boolean;
    currentCrabCode: string | null;
    assignments: TrayAssignmentHistoryInput[];
  }>,
  now: Date = new Date()
): TraySummaryRow[] {
  return [...trays]
    .sort((a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10))
    .map((t) => {
      const history = buildTrayHistoryRows(t.assignments, now);
      return {
        id: t.id,
        trayNumber: t.number,
        active: t.active,
        isTreatmentTray: t.isTreatmentTray,
        currentCrabCode: t.currentCrabCode,
        staysCount: history.length,
        soldCount: history.filter((h) => h.outcome === "SOLD").length,
        deadCount: history.filter((h) => h.outcome === "DEAD").length,
        realizedProfit: r2(
          history.reduce((s, h) => s + (h.profit ?? 0), 0)
        ),
      };
    });
}

export interface FarmKpis {
  avgGrowthGPerDay: number | null;
  avgDaysToSale: number | null;
  totalCrabs: number;
  activeCount: number;
  sickCount: number;
  soldCount: number;
  deadCount: number;
  mortalityRatePct: number | null;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
}

export function computeFarmKPIs(
  crabRows: CrabPnlRow[],
  pendingSales: Array<{ totalAmount: number | string | { toString(): string } }>
): FarmKpis {
  const withDays = crabRows.filter((c) => c.daysInSystem > 0);
  const avgGrowthGPerDay =
    withDays.length > 0
      ? r2(
          withDays.reduce((s, c) => s + c.growthGPerDay, 0) / withDays.length
        )
      : null;

  const sold = crabRows.filter((c) => c.status === "SOLD");
  const avgDaysToSale =
    sold.length > 0
      ? r2(sold.reduce((s, c) => s + c.daysInSystem, 0) / sold.length)
      : null;

  const deadCount = crabRows.filter((c) => c.status === "DEAD").length;
  const totalCrabs = crabRows.length;
  const mortalityRatePct =
    totalCrabs > 0 ? Math.round((deadCount / totalCrabs) * 1000) / 10 : null;

  const pendingPaymentsAmount = r2(
    pendingSales.reduce((s, p) => s + toNumber(p.totalAmount), 0)
  );

  return {
    avgGrowthGPerDay,
    avgDaysToSale,
    totalCrabs,
    activeCount: crabRows.filter((c) => c.status === "ACTIVE").length,
    sickCount: crabRows.filter((c) => c.status === "SICK").length,
    soldCount: sold.length,
    deadCount,
    mortalityRatePct,
    pendingPaymentsCount: pendingSales.length,
    pendingPaymentsAmount,
  };
}

