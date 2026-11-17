import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { computeCrabMetrics } from "@/lib/crab-metrics";
import { buildCrabActionContext } from "@/lib/crab-context";
import {
  diffCalendarDaysIST,
  formatDateIN,
  formatINR,
  formatNumberIN,
  toISTDateString,
  toNumber,
} from "@/lib/format";
import { CrabActionModals } from "@/components/crab-action-modals";
import {
  CrabCharts,
  type DailyFeedChartPoint,
  type WeightChartPoint,
} from "@/components/crab-charts";
import {
  CrabDetailTabs,
  type CrabDetailLogsData,
} from "@/components/crab-detail-tabs";
import { CrabDangerControls } from "@/components/crab-danger-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CrabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [crab, actionContext] = await Promise.all([
    db.crab.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
        currentTray: { select: { id: true, number: true, isTreatmentTray: true } },
        assignments: {
          include: {
            tray: {
              select: {
                id: true,
                number: true,
                active: true,
                currentCrab: { select: { code: true } },
              },
            },
          },
          orderBy: { fromDate: "desc" },
        },
        weightLogs: { orderBy: { date: "desc" } },
        moltLogs: { orderBy: { date: "desc" } },
        feedLogs: {
          include: { feedType: { select: { name: true, costPerKg: true } } },
          orderBy: { dateTime: "desc" },
        },
        treatmentLogs: { orderBy: { date: "desc" } },
        sale: {
          include: { buyer: { select: { id: true, name: true } } },
        },
      },
    }),
    buildCrabActionContext(id),
  ]);

  if (!crab || !actionContext) {
    notFound();
  }

  const now = new Date();
  const metrics = computeCrabMetrics(crab, now);
  const totalCosts =
    metrics.purchaseCost + metrics.feedCost + metrics.treatmentCost;

  // Build chronological weight chart points
  const rawWeightPoints: Array<{ ts: number; dateLabel: string; weightG: number; source: string }> = [
    {
      ts: crab.stockedDate.getTime(),
      dateLabel: formatDateIN(crab.stockedDate),
      weightG: crab.initialWeightG,
      source: "Stocked",
    },
    ...crab.weightLogs.map((w) => ({
      ts: w.date.getTime(),
      dateLabel: formatDateIN(w.date),
      weightG: w.weightG,
      source: "Weight log",
    })),
    ...crab.moltLogs
      .filter((m): m is typeof m & { weightAfterG: number } => m.weightAfterG !== null)
      .map((m) => ({
        ts: m.date.getTime(),
        dateLabel: formatDateIN(m.date),
        weightG: m.weightAfterG,
        source: "Post-molt",
      })),
  ];
  if (crab.endDate && crab.finalWeightG !== null) {
    rawWeightPoints.push({
      ts: crab.endDate.getTime(),
      dateLabel: formatDateIN(crab.endDate),
      weightG: crab.finalWeightG,
      source: crab.status === "SOLD" ? "Sale" : "Final",
    });
  }
  rawWeightPoints.sort((a, b) => a.ts - b.ts);
  const weightPoints: WeightChartPoint[] = rawWeightPoints.map((p) => ({
    dateLabel: p.dateLabel,
    weightG: p.weightG,
    source: p.source,
  }));

  // Group feed intake per IST day chronologically
  const feedByDay = new Map<string, number>();
  for (const f of [...crab.feedLogs].reverse()) {
    const day = toISTDateString(f.dateTime);
    feedByDay.set(day, (feedByDay.get(day) ?? 0) + f.quantityG);
  }
  const dailyFeedPoints: DailyFeedChartPoint[] = Array.from(
    feedByDay.entries()
  ).map(([ymd, grams]) => ({
    dateLabel: formatDateIN(new Date(`${ymd}T12:00:00+05:30`)).slice(0, 5),
    grams: Math.round(grams * 10) / 10,
  }));

  const feedTypesMap = new Map(
    actionContext.feedTypes.map((ft) => [ft.id, ft])
  );
  for (const f of crab.feedLogs) {
    if (!feedTypesMap.has(f.feedTypeId)) {
      feedTypesMap.set(f.feedTypeId, {
        id: f.feedTypeId,
        name: `${f.feedType.name} (inactive)`,
        costPerKg: toNumber(f.feedType.costPerKg),
      });
    }
  }
  const feedTypeOptions = Array.from(feedTypesMap.values());

  const latestAssignment = crab.assignments[0] ?? null;
  const lastTray = latestAssignment
    ? {
        id: latestAssignment.tray.id,
        number: latestAssignment.tray.number,
        isFreeAndActive:
          latestAssignment.tray.active && latestAssignment.tray.currentCrab === null,
        heldByCode: latestAssignment.tray.currentCrab?.code ?? null,
      }
    : null;

  const serializedLogs: CrabDetailLogsData = {
    feedLogs: crab.feedLogs.map((f) => ({
      id: f.id,
      dateTime: f.dateTime.toISOString(),
      feedTypeId: f.feedTypeId,
      feedName: f.feedType.name,
      quantityG: f.quantityG,
      timeSlot: f.timeSlot,
      costAtTime: toNumber(f.costAtTime),
      notes: f.notes,
    })),
    weightLogs: crab.weightLogs.map((w) => ({
      id: w.id,
      date: w.date.toISOString(),
      weightG: w.weightG,
    })),
    moltLogs: crab.moltLogs.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      stage: m.stage,
      weightAfterG: m.weightAfterG,
      notes: m.notes,
    })),
    treatmentLogs: crab.treatmentLogs.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      symptoms: t.symptoms,
      diagnosis: t.diagnosis,
      treatment: t.treatment,
      dose: t.dose,
      cost: toNumber(t.cost),
      outcome: t.outcome,
      notes: t.notes,
    })),
    assignments: crab.assignments.map((a) => ({
      id: a.id,
      trayId: a.tray.id,
      trayNumber: a.tray.number,
      fromDate: a.fromDate.toISOString(),
      toDate: a.toDate ? a.toDate.toISOString() : null,
      days: diffCalendarDaysIST(a.fromDate, a.toDate ?? now),
      reason: a.reason,
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Link
          href="/crabs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Crabs
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold font-mono text-slate-900">
                Crab {crab.code}
              </h1>
              <Badge
                variant={
                  crab.status === "SICK"
                    ? "danger"
                    : crab.status === "ACTIVE"
                    ? "teal"
                    : crab.status === "SOLD"
                    ? "success"
                    : "default"
                }
              >
                {crab.status}
              </Badge>
              {crab.currentTray ? (
                <Link
                  href={`/trays/${crab.currentTray.id}`}
                  className="inline-flex items-center rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-900 hover:bg-teal-100"
                >
                  Tray {crab.currentTray.number}
                  {crab.currentTray.isTreatmentTray ? " (Treatment)" : ""}
                </Link>
              ) : (
                <Badge variant="default">Tray freed</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Batch {crab.batch.letter} • {crab.sex} • Supplier:{" "}
              <span className="font-semibold text-slate-800">
                {crab.batch.supplier.name}
              </span>{" "}
              • Stocked {formatDateIN(crab.stockedDate)}
              {crab.expectedHarvestDate
                ? ` • Target harvest ${formatDateIN(crab.expectedHarvestDate)}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <CrabActionModals data={actionContext} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Days in RAS</div>
            <div className="text-xl font-bold text-slate-900">
              {metrics.daysInSystem} d
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Latest Weight</div>
            <div className="text-xl font-bold text-slate-900">
              {formatNumberIN(metrics.latestWeightG, 0)} g
            </div>
            <div className="text-[11px] text-slate-500">
              Start {formatNumberIN(crab.initialWeightG, 0)} g
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Weight Gain</div>
            <div className="text-xl font-bold text-teal-800">
              {metrics.weightGainG >= 0 ? "+" : ""}
              {formatNumberIN(metrics.weightGainG, 0)} g
            </div>
            <div className="text-[11px] text-slate-500">
              {formatNumberIN(metrics.growthGPerDay, 2)} g/day
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Total Feed / FCR</div>
            <div className="text-xl font-bold text-slate-900">
              {formatNumberIN(metrics.totalFeedG, 0)} g
            </div>
            <div className="text-[11px] text-slate-500">
              FCR: {metrics.fcr !== null ? formatNumberIN(metrics.fcr, 2) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Direct Costs</div>
            <div className="text-xl font-bold text-slate-900">
              {formatINR(totalCosts)}
            </div>
            <div className="text-[11px] text-slate-500">
              Buy {formatINR(metrics.purchaseCost)} + Feed {formatINR(metrics.feedCost)}
              {metrics.treatmentCost > 0
                ? ` + Tx ${formatINR(metrics.treatmentCost)}`
                : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">
              {crab.status === "DEAD" ? "Realized Loss" : "Profit / Outcome"}
            </div>
            <div
              className={`text-xl font-bold ${
                metrics.profit === null
                  ? "text-slate-600"
                  : metrics.profit >= 0
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {metrics.profit !== null ? formatINR(metrics.profit) : "In cycle"}
            </div>
            {crab.sale && (
              <div className="text-[11px] text-slate-600">
                Sold {formatDateIN(crab.sale.date)} • {crab.sale.paymentStatus}
              </div>
            )}
            {crab.status === "DEAD" && crab.deathCause && (
              <div className="text-[11px] text-red-700 truncate">
                {crab.deathCause}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {crab.notes && (
        <Card>
          <CardContent className="p-3.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Notes: </span>
            {crab.notes}
          </CardContent>
        </Card>
      )}

      <CrabCharts weightPoints={weightPoints} dailyFeedPoints={dailyFeedPoints} />

      <CrabDetailTabs logs={serializedLogs} feedTypes={feedTypeOptions} />

      <CrabDangerControls
        crabId={crab.id}
        crabCode={crab.code}
        sale={
          crab.sale
            ? {
                id: crab.sale.id,
                buyerName: crab.sale.buyer.name,
                totalAmountLabel: formatINR(crab.sale.totalAmount),
              }
            : null
        }
        lastTray={lastTray}
        emptyTrays={actionContext.emptyTrays}
        counts={{
          feedLogs: crab.feedLogs.length,
          weightLogs: crab.weightLogs.length,
          moltLogs: crab.moltLogs.length,
          treatmentLogs: crab.treatmentLogs.length,
          assignments: crab.assignments.length,
        }}
      />
    </div>
  );
}

