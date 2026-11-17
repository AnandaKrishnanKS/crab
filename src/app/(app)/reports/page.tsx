import { db } from "@/lib/db";
import { formatDateIN, toNumber } from "@/lib/format";
import {
  buildBatchPnlRows,
  buildCrabPnlRows,
  buildMonthlyPnlSeries,
  buildTraySummaryRows,
  computeFarmKPIs,
  type ReportCrabInput,
} from "@/lib/reports";
import { ReportsClient, type PendingSaleRow } from "@/components/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const now = new Date();
  const [
    crabsRaw,
    batchesRaw,
    traysRaw,
    pendingSalesRaw,
    allSales,
    allFeedLogs,
    allTreatments,
    allMinerals,
    allSystemLogs,
    allExpenses,
  ] = await Promise.all([
    db.crab.findMany({
      include: {
        batch: { select: { id: true, letter: true } },
        weightLogs: { select: { date: true, weightG: true } },
        moltLogs: { select: { date: true, stage: true, weightAfterG: true } },
        feedLogs: { select: { quantityG: true, costAtTime: true } },
        treatmentLogs: { select: { cost: true } },
        sale: { select: { totalAmount: true } },
      },
      orderBy: [{ stockedDate: "desc" }, { seq: "asc" }],
    }),
    db.batch.findMany({
      include: {
        supplier: { select: { name: true } },
      },
      orderBy: { purchaseDate: "desc" },
    }),
    db.tray.findMany({
      include: {
        currentCrab: { select: { code: true } },
        assignments: {
          include: {
            crab: {
              include: {
                assignments: { select: { id: true, fromDate: true } },
                weightLogs: { select: { date: true, weightG: true } },
                moltLogs: { select: { date: true, stage: true, weightAfterG: true } },
                feedLogs: { select: { quantityG: true, costAtTime: true } },
                treatmentLogs: { select: { cost: true } },
                sale: { select: { totalAmount: true } },
              },
            },
          },
          orderBy: { fromDate: "desc" },
        },
      },
    }),
    db.sale.findMany({
      where: { paymentStatus: "PENDING" },
      include: {
        crab: { select: { id: true, code: true } },
        buyer: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    db.sale.findMany({ select: { date: true, totalAmount: true } }),
    db.feedLog.findMany({ select: { dateTime: true, costAtTime: true } }),
    db.treatmentLog.findMany({ select: { date: true, cost: true } }),
    db.mineralAddition.findMany({ select: { dateTime: true, costAtTime: true } }),
    db.systemLog.findMany({
      where: { cost: { not: null } },
      select: { date: true, cost: true },
    }),
    db.expense.findMany({ select: { date: true, amount: true } }),
  ]);

  const reportCrabs: ReportCrabInput[] = crabsRaw.map((c) => ({
    id: c.id,
    code: c.code,
    batchId: c.batchId,
    batchLetter: c.batch.letter,
    sex: c.sex,
    initialWeightG: c.initialWeightG,
    finalWeightG: c.finalWeightG,
    purchaseCost: c.purchaseCost,
    stockedDate: c.stockedDate,
    endDate: c.endDate,
    status: c.status,
    weightLogs: c.weightLogs,
    moltLogs: c.moltLogs,
    feedLogs: c.feedLogs,
    treatmentLogs: c.treatmentLogs,
    sale: c.sale,
  }));

  const crabPnl = buildCrabPnlRows(reportCrabs, now);
  const crabsByBatch = new Map<string, ReportCrabInput[]>();
  for (const c of reportCrabs) {
    const arr = crabsByBatch.get(c.batchId) ?? [];
    arr.push(c);
    crabsByBatch.set(c.batchId, arr);
  }

  const batchPnl = buildBatchPnlRows(
    batchesRaw.map((b) => ({
      id: b.id,
      letter: b.letter,
      purchaseDate: b.purchaseDate,
      supplierName: b.supplier.name,
      crabs: crabsByBatch.get(b.id) ?? [],
    })),
    now
  );

  const traySummary = buildTraySummaryRows(
    traysRaw.map((t) => ({
      id: t.id,
      number: t.number,
      active: t.active,
      isTreatmentTray: t.isTreatmentTray,
      currentCrabCode: t.currentCrab?.code ?? null,
      assignments: t.assignments.map((a) => ({
        id: a.id,
        fromDate: a.fromDate,
        toDate: a.toDate,
        reason: a.reason,
        hasLaterAssignment: a.crab.assignments.some(
          (other) => other.fromDate.getTime() > a.fromDate.getTime()
        ),
        crab: a.crab,
      })),
    })),
    now
  );

  const monthlyPnl = buildMonthlyPnlSeries({
    sales: allSales,
    crabPurchases: crabsRaw.map((c) => ({
      stockedDate: c.stockedDate,
      purchaseCost: c.purchaseCost,
    })),
    feedLogs: allFeedLogs,
    treatmentLogs: allTreatments,
    mineralAdditions: allMinerals,
    systemLogs: allSystemLogs,
    expenses: allExpenses,
  });

  const kpis = computeFarmKPIs(crabPnl, pendingSalesRaw);

  const pendingSales: PendingSaleRow[] = pendingSalesRaw.map((s) => ({
    saleId: s.id,
    crabId: s.crab.id,
    crabCode: s.crab.code,
    buyerName: s.buyer.name,
    dateLabel: formatDateIN(s.date),
    weightG: s.weightG,
    totalAmount: toNumber(s.totalAmount),
  }));

  return (
    <ReportsClient
      kpis={kpis}
      monthlyPnl={monthlyPnl}
      pendingSales={pendingSales}
      batchPnl={batchPnl}
      crabPnl={crabPnl}
      traySummary={traySummary}
    />
  );
}
