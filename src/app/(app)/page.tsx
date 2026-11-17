import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Droplets,
  IndianRupee,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/db";
import { getLatestCrabWeightG } from "@/lib/crab-metrics";
import {
  buildDashboardAlerts,
  evaluateWaterParameters,
  evaluateWaterSchedules,
  type DashboardThresholds,
  type IndicatorLevel,
} from "@/lib/dashboard";
import { computePeriodFinancials } from "@/lib/finance";
import {
  diffCalendarDaysIST,
  formatDateIN,
  formatDateTimeIN,
  formatINR,
  formatNumberIN,
  getISTDayBounds,
  getISTMonthBounds,
  getISTYearMonth,
  toISTDateString,
} from "@/lib/format";
import { computeWaterRatios } from "@/lib/water";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const LEVEL_STYLES: Record<
  IndicatorLevel,
  { pill: string; badgeVariant: "success" | "warning" | "danger" }
> = {
  green: {
    pill: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
    badgeVariant: "success",
  },
  amber: {
    pill: "border-amber-300 bg-amber-50 text-amber-950",
    badgeVariant: "warning",
  },
  red: {
    pill: "border-red-300 bg-red-50 text-red-950",
    badgeVariant: "danger",
  },
};

function StatusIcon({ level }: { level: IndicatorLevel }) {
  if (level === "red") {
    return <AlertCircle className="h-3.5 w-3.5 text-red-700 shrink-0" />;
  }
  if (level === "amber") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />;
}

export default async function DashboardPage() {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getISTDayBounds(now);
  const { year, month } = getISTYearMonth(now);
  const { start: monthStart, end: monthEnd } = getISTMonthBounds(year, month);
  const todayYmd = toISTDateString(now);

  const [
    settings,
    latestWaterTest,
    latestWaterChange,
    traysRaw,
    openCrabs,
    activeMinerals,
    pendingSalesRaw,
    monthSales,
    monthPurchases,
    monthFeedLogs,
    monthTreatments,
    monthMinerals,
    monthSystemLogs,
    monthExpenses,
  ] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.waterTest.findFirst({ orderBy: { dateTime: "desc" } }),
    db.waterChange.findFirst({ orderBy: { date: "desc" } }),
    db.tray.findMany({
      where: { active: true },
      include: {
        currentCrab: {
          include: {
            weightLogs: {
              orderBy: { date: "desc" },
              take: 1,
              select: { date: true, weightG: true },
            },
            moltLogs: {
              orderBy: { date: "desc" },
              take: 1,
              select: { date: true, stage: true, weightAfterG: true },
            },
            feedLogs: {
              orderBy: { dateTime: "desc" },
              select: { dateTime: true, quantityG: true },
            },
          },
        },
      },
    }),
    db.crab.findMany({
      where: { status: { in: ["ACTIVE", "SICK"] } },
      include: {
        currentTray: { select: { number: true } },
        moltLogs: {
          orderBy: { date: "desc" },
          take: 1,
          select: { stage: true },
        },
        feedLogs: {
          where: { dateTime: { gte: todayStart, lt: todayEnd } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    db.mineral.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, formula: true, stockKg: true },
    }),
    db.sale.findMany({
      where: { paymentStatus: "PENDING" },
      include: {
        crab: { select: { id: true, code: true } },
        buyer: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    db.sale.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { totalAmount: true },
    }),
    db.crab.findMany({
      where: { stockedDate: { gte: monthStart, lt: monthEnd } },
      select: { purchaseCost: true },
    }),
    db.feedLog.findMany({
      where: { dateTime: { gte: monthStart, lt: monthEnd } },
      select: { costAtTime: true },
    }),
    db.treatmentLog.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { cost: true },
    }),
    db.mineralAddition.findMany({
      where: { dateTime: { gte: monthStart, lt: monthEnd } },
      select: { costAtTime: true },
    }),
    db.systemLog.findMany({
      where: { date: { gte: monthStart, lt: monthEnd }, cost: { not: null } },
      select: { cost: true },
    }),
    db.expense.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { amount: true },
    }),
  ]);

  const thresholds: DashboardThresholds = {
    waterTestIntervalDays: settings?.waterTestIntervalDays ?? 1,
    waterChangeWarnDays: settings?.waterChangeWarnDays ?? 90,
    waterChangeIntervalDays: settings?.waterChangeIntervalDays ?? 120,
    salinityMin: settings?.salinityMin ?? 18,
    salinityMax: settings?.salinityMax ?? 25,
    phMin: settings?.phMin ?? 7.6,
    phMax: settings?.phMax ?? 8.3,
    ammoniaMax: settings?.ammoniaMax ?? 0.25,
    nitriteMax: settings?.nitriteMax ?? 0.25,
    nitrateMax: settings?.nitrateMax ?? 40,
    tempMin: settings?.tempMin ?? 26,
    tempMax: settings?.tempMax ?? 31,
    targetFatteningDays: settings?.targetFatteningDays ?? 45,
    lowMineralStockKg: settings?.lowMineralStockKg ?? 2,
    softCrabAlert: settings?.softCrabAlert ?? true,
  };

  const paramStatuses = evaluateWaterParameters(latestWaterTest, thresholds);
  const schedule = evaluateWaterSchedules(
    latestWaterTest?.dateTime ?? null,
    latestWaterChange?.date ?? null,
    thresholds,
    now
  );

  const latestRatios = latestWaterChange
    ? computeWaterRatios({
        calciumMgL: latestWaterChange.calciumMgL,
        magnesiumMgL: latestWaterChange.magnesiumMgL,
        potassiumMgL: latestWaterChange.potassiumMgL,
        sodiumMgL: latestWaterChange.sodiumMgL,
      })
    : null;

  const unfedActiveCrabs = openCrabs
    .filter((c) => c.status === "ACTIVE" && c.feedLogs.length === 0)
    .map((c) => ({
      id: c.id,
      code: c.code,
      trayNumber: c.currentTray?.number ?? null,
    }));

  const sickCrabs = openCrabs
    .filter((c) => c.status === "SICK")
    .map((c) => ({
      id: c.id,
      code: c.code,
      trayNumber: c.currentTray?.number ?? null,
    }));

  const pastTargetCrabs = openCrabs
    .map((c) => ({
      id: c.id,
      code: c.code,
      daysInSystem: diffCalendarDaysIST(c.stockedDate, now),
    }))
    .filter((c) => c.daysInSystem >= thresholds.targetFatteningDays);

  const softOrMoltedCrabs = openCrabs
    .map((c) => ({
      id: c.id,
      code: c.code,
      stage: c.moltLogs[0]?.stage ?? null,
    }))
    .filter(
      (c): c is { id: string; code: string; stage: "SOFT" | "MOLTED" } =>
        c.stage === "SOFT" || c.stage === "MOLTED"
    );

  const lowStockMinerals = activeMinerals
    .filter(
      (m): m is typeof m & { stockKg: number } =>
        m.stockKg !== null && m.stockKg <= thresholds.lowMineralStockKg
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      formula: m.formula,
      stockKg: m.stockKg,
    }));

  const pendingSales = pendingSalesRaw.map((s) => ({
    id: s.id,
    crabId: s.crab.id,
    crabCode: s.crab.code,
    totalAmount: Number(s.totalAmount),
    buyerName: s.buyer.name,
  }));

  const alerts = buildDashboardAlerts({
    thresholds,
    schedule,
    paramStatuses,
    unfedActiveCrabs,
    pastTargetCrabs,
    softOrMoltedCrabs,
    sickCrabs,
    pendingSales,
    lowStockMinerals,
  });

  const monthFinancial = computePeriodFinancials({
    sales: monthSales,
    crabPurchases: monthPurchases,
    feedLogs: monthFeedLogs,
    treatmentLogs: monthTreatments,
    mineralAdditions: monthMinerals,
    systemLogs: monthSystemLogs,
    expenses: monthExpenses,
  });

  const sortedTrays = [...traysRaw].sort(
    (a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10)
  );
  const occupiedCount = sortedTrays.filter((t) => t.currentCrab !== null).length;
  const activeCount = openCrabs.filter((c) => c.status === "ACTIVE").length;
  const monthLabel = `${String(month).padStart(2, "0")}/${year}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            RAS Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            {occupiedCount}/{sortedTrays.length} trays occupied • {activeCount} ACTIVE •{" "}
            {sickCrabs.length} SICK
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/daily"
            className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 shadow-xs"
          >
            Open Daily Log
          </Link>
          <Link
            href="/batches/new"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            New Batch
          </Link>
        </div>
      </header>

      {/* 1. Whole-RAS Water Status Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Droplets className="h-5 w-5 text-teal-700" />
                Whole-RAS Water Status
              </CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">
                {latestWaterTest
                  ? `Latest test: ${formatDateTimeIN(latestWaterTest.dateTime)}`
                  : "No water tests recorded yet"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={LEVEL_STYLES[schedule.testStatus].badgeVariant}>
                <StatusIcon level={schedule.testStatus} />
                <span className="ml-1">
                  Test:{" "}
                  {schedule.daysSinceTest !== null
                    ? `${schedule.daysSinceTest} d ago (${schedule.testStatusLabel})`
                    : schedule.testStatusLabel}
                </span>
              </Badge>
              <Badge variant={LEVEL_STYLES[schedule.changeStatus].badgeVariant}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Change:{" "}
                {schedule.daysSinceChange !== null
                  ? `${schedule.daysSinceChange} d ago (${schedule.changeStatusLabel})`
                  : schedule.changeStatusLabel}
              </Badge>
              <Link
                href="/water"
                className="text-xs font-semibold text-teal-800 hover:underline"
              >
                Water Details
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {paramStatuses.length === 0 ? (
            <p className="text-sm text-slate-600">
              Log your first water test on{" "}
              <Link href="/daily#water-test" className="font-semibold underline text-teal-800">
                Daily Log
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {paramStatuses.map((p) => (
                <div
                  key={p.key}
                  className={`rounded-lg border px-3 py-2 ${LEVEL_STYLES[p.level].pill}`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                    <span>{p.label}</span>
                    <span className="inline-flex items-center gap-1">
                      <StatusIcon level={p.level} />
                      {p.statusText}
                    </span>
                  </div>
                  <div className="text-base font-extrabold mt-0.5">{p.valueText}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <div>
              {schedule.nextChangeDueDate ? (
                <span>
                  Next full water change due:{" "}
                  <span className="font-bold text-slate-900">
                    {formatDateIN(schedule.nextChangeDueDate)}
                  </span>{" "}
                  ({thresholds.waterChangeIntervalDays}d cycle)
                </span>
              ) : (
                <span>No full water change logged yet.</span>
              )}
            </div>
            {latestRatios &&
              (latestRatios.mgToCa !== null ||
                latestRatios.naToK !== null ||
                latestRatios.caToK !== null) && (
                <div className="flex flex-wrap gap-3 font-semibold text-slate-800">
                  {latestRatios.mgToCa !== null && (
                    <span>Mg:Ca {latestRatios.mgToCa}:1</span>
                  )}
                  {latestRatios.naToK !== null && (
                    <span>Na:K {latestRatios.naToK}:1</span>
                  )}
                  {latestRatios.caToK !== null && (
                    <span>Ca:K {latestRatios.caToK}:1</span>
                  )}
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Alerts Section */}
      <Card>
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Attention &amp; Alerts
            </CardTitle>
            <Badge variant={alerts.length === 0 ? "success" : "warning"}>
              {alerts.length === 0 ? "All clear" : `${alerts.length} active`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-800 py-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>All water tests, feeding schedules, and crab statuses are on track.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {alerts.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className={`rounded-lg border p-3 flex items-start justify-between gap-2.5 transition-colors hover:opacity-90 ${
                    a.severity === "red"
                      ? "border-red-300 bg-red-50 text-red-950"
                      : "border-amber-300 bg-amber-50 text-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {a.severity === "red" ? (
                      <AlertCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-snug">{a.title}</div>
                      <div className="text-xs opacity-90 mt-0.5 line-clamp-2">{a.detail}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. This Month Financial Card */}
      <Card>
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="h-4 w-4 text-teal-700" />
              This Month Summary ({monthLabel})
            </CardTitle>
            <Link
              href="/reports"
              className="text-xs font-semibold text-teal-800 hover:underline"
            >
              View Reports &amp; Exports
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">Sales Revenue</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {formatINR(monthFinancial.salesRevenue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">Total Expenses</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {formatINR(monthFinancial.totalExpenses)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">Net Profit</div>
              <div
                className={`text-xl font-extrabold mt-0.5 ${
                  monthFinancial.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatINR(monthFinancial.netProfit)}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Stocked Crabs: {formatINR(monthFinancial.crabPurchasesCost)}</span>
            <span>Feed: {formatINR(monthFinancial.feedCost)}</span>
            <span>Chemicals: {formatINR(monthFinancial.mineralCost)}</span>
            <span>
              Treatments/Maint/Ops:{" "}
              {formatINR(
                monthFinancial.treatmentCost +
                  monthFinancial.maintenanceCost +
                  monthFinancial.operatingExpensesCost
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Tray Grid (01..N) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Tray Grid ({occupiedCount}/{sortedTrays.length} occupied)
            </h2>
            <p className="text-xs text-slate-600">
              Tap any tray to inspect current crab or lifetime tray history.
            </p>
          </div>
          <Link
            href="/trays"
            className="text-xs font-semibold text-teal-800 hover:underline"
          >
            Manage Trays
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedTrays.map((tray) => {
            const crab = tray.currentCrab;
            if (!crab) {
              return (
                <Link key={tray.id} href={`/trays/${tray.id}`}>
                  <Card className="h-full border-dashed border-slate-300 bg-slate-50/70 hover:border-teal-500 transition-colors">
                    <CardContent className="p-3.5 flex flex-col justify-between h-full min-h-[126px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-lg font-extrabold text-slate-700">
                          {tray.number}
                        </span>
                        <Badge variant="default">EMPTY</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-3">
                        {tray.isTreatmentTray ? (
                          <span className="font-semibold text-amber-800">
                            Treatment tray
                          </span>
                        ) : (
                          "Ready to stock"
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            }

            const isSick = crab.status === "SICK";
            const days = diffCalendarDaysIST(crab.stockedDate, now);
            const latestWt = getLatestCrabWeightG(
              crab.initialWeightG,
              crab.finalWeightG,
              crab.weightLogs,
              crab.moltLogs
            );
            const latestFeed = crab.feedLogs[0] ?? null;
            const todayFeedG = crab.feedLogs
              .filter((f) => toISTDateString(f.dateTime) === todayYmd)
              .reduce((sum, f) => sum + f.quantityG, 0);
            const lastMoltStage = crab.moltLogs[0]?.stage ?? null;
            const isSoftMolt =
              thresholds.softCrabAlert &&
              (lastMoltStage === "SOFT" || lastMoltStage === "MOLTED");

            return (
              <Link key={tray.id} href={`/trays/${tray.id}`}>
                <Card
                  className={`h-full transition-colors ${
                    isSick
                      ? "border-red-400 bg-red-50/80 hover:border-red-600"
                      : isSoftMolt
                      ? "border-amber-400 bg-amber-50/50 hover:border-amber-600"
                      : "border-teal-300 bg-white hover:border-teal-600"
                  }`}
                >
                  <CardContent className="p-3.5 space-y-2 min-h-[126px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-sm font-bold text-slate-600">
                        Tray {tray.number}
                      </span>
                      <Badge variant={isSick ? "danger" : "teal"}>
                        {isSick && <AlertCircle className="h-3 w-3 mr-1" />}
                        {crab.status}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-mono text-xl font-extrabold text-slate-900">
                        {crab.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {formatNumberIN(latestWt, 0)} g • {days} d
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {isSick ? (
                          <span className="font-semibold text-red-800">
                            Under treatment (skipped feed alert)
                          </span>
                        ) : todayFeedG > 0 ? (
                          <span className="font-semibold text-emerald-800">
                            Fed {formatNumberIN(todayFeedG, 0)} g today
                          </span>
                        ) : latestFeed ? (
                          <span className="font-semibold text-amber-800">
                            Not fed today (last {formatDateIN(latestFeed.dateTime)})
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-800">
                            Not fed today
                          </span>
                        )}
                      </div>
                      {(lastMoltStage || tray.isTreatmentTray) && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {lastMoltStage && (
                            <Badge variant={isSoftMolt ? "warning" : "default"}>
                              {lastMoltStage}
                            </Badge>
                          )}
                          {tray.isTreatmentTray && (
                            <Badge variant="danger">Tx Tray</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
