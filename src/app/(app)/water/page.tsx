import { db } from "@/lib/db";
import {
  formatDateIN,
  toISTDateString,
  toISTDateTimeInput,
  toNumber,
} from "@/lib/format";
import {
  computeAddedIonsMg,
  computeWaterRatios,
  sumAddedIonsMg,
} from "@/lib/water";
import {
  WaterManager,
  type MineralAdditionItem,
  type WaterChangeItem,
  type WaterTabId,
  type WeeklyIonRow,
} from "@/components/water-manager";
import type { MonthlyChemicalChartPoint } from "@/components/water-charts";

export const dynamic = "force-dynamic";

const VALID_TABS: readonly WaterTabId[] = [
  "tests",
  "changes",
  "chemicals",
  "calculator",
  "maintenance",
];

function getISTMondayKey(date: Date): string {
  const ymd = toISTDateString(date);
  const istNoon = new Date(`${ymd}T12:00:00+05:30`);
  const day = istNoon.getUTCDay(); // 0=Sun..6=Sat (at 06:30 UTC, always matches IST calendar weekday)
  const diffToMon = day === 0 ? 6 : day - 1;
  return toISTDateString(
    new Date(istNoon.getTime() - diffToMon * 24 * 60 * 60 * 1000)
  );
}

function formatMonthLabel(ymKey: string): string {
  const [y, m] = ymKey.split("-");
  return `${m}/${y}`;
}

export default async function WaterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  const now = new Date();
  const [
    params,
    settings,
    waterTestsRaw,
    waterChangesRaw,
    mineralsRaw,
    additionsRaw,
    systemLogsRaw,
  ] = await Promise.all([
    searchParams,
    db.settings.findUnique({ where: { id: 1 } }),
    db.waterTest.findMany({ orderBy: { dateTime: "desc" } }),
    db.waterChange.findMany({
      include: {
        mineralAdditions: {
          include: { mineral: true },
          orderBy: { dateTime: "desc" },
        },
      },
      orderBy: { date: "desc" },
    }),
    db.mineral.findMany({ orderBy: { name: "asc" } }),
    db.mineralAddition.findMany({
      include: {
        mineral: true,
        waterChange: { select: { id: true, date: true } },
      },
      orderBy: { dateTime: "desc" },
    }),
    db.systemLog.findMany({ orderBy: { date: "desc" } }),
  ]);

  const initialTab: WaterTabId = VALID_TABS.includes(params.tab as WaterTabId)
    ? (params.tab as WaterTabId)
    : "tests";
  const openNewOnLoad = params.new === "1";

  const waterTests = waterTestsRaw.map((t) => ({
    id: t.id,
    dateTime: t.dateTime.toISOString(),
    salinityPpt: t.salinityPpt,
    pH: t.pH,
    ammoniaMgL: t.ammoniaMgL,
    nitriteMgL: t.nitriteMgL,
    nitrateMgL: t.nitrateMgL,
    alkalinityMgL: t.alkalinityMgL,
    temperatureC: t.temperatureC,
    dissolvedOxygenMgL: t.dissolvedOxygenMgL,
    notes: t.notes,
  }));

  const waterChanges: WaterChangeItem[] = waterChangesRaw.map((wc) => {
    const ionItems = wc.mineralAdditions.map((a) =>
      computeAddedIonsMg(a.quantityG, a.mineral)
    );
    return {
      id: wc.id,
      date: wc.date.toISOString(),
      quantityLitres: wc.quantityLitres,
      percentChanged: wc.percentChanged,
      calciumMgL: wc.calciumMgL,
      magnesiumMgL: wc.magnesiumMgL,
      potassiumMgL: wc.potassiumMgL,
      sodiumMgL: wc.sodiumMgL,
      notes: wc.notes,
      ratios: computeWaterRatios({
        calciumMgL: wc.calciumMgL,
        magnesiumMgL: wc.magnesiumMgL,
        potassiumMgL: wc.potassiumMgL,
        sodiumMgL: wc.sodiumMgL,
      }),
      chemicals: wc.mineralAdditions.map((a) => ({
        id: a.id,
        mineralName: a.mineral.name,
        formula: a.mineral.formula,
        quantityG: a.quantityG,
        costAtTime: toNumber(a.costAtTime),
      })),
      ionTotals: sumAddedIonsMg(ionItems),
    };
  });

  const minerals = mineralsRaw.map((m) => ({
    id: m.id,
    name: m.name,
    formula: m.formula,
    purpose: m.purpose,
    costPerKg: toNumber(m.costPerKg),
    stockKg: m.stockKg,
    active: m.active,
    naFraction: m.naFraction,
    mgFraction: m.mgFraction,
    caFraction: m.caFraction,
    kFraction: m.kFraction,
    clFraction: m.clFraction,
    so4Fraction: m.so4Fraction,
    hco3Fraction: m.hco3Fraction,
  }));

  const mineralAdditions: MineralAdditionItem[] = additionsRaw.map((a) => ({
    id: a.id,
    dateTime: a.dateTime.toISOString(),
    mineralId: a.mineralId,
    mineralName: a.mineral.name,
    formula: a.mineral.formula,
    quantityG: a.quantityG,
    costAtTime: toNumber(a.costAtTime),
    reason: a.reason,
    waterChangeId: a.waterChangeId,
    waterChangeDateLabel: a.waterChange
      ? formatDateIN(a.waterChange.date)
      : null,
    notes: a.notes,
    ionsMg: computeAddedIonsMg(a.quantityG, a.mineral),
  }));

  // Aggregate monthly chemical consumption (oldest -> newest)
  const monthMap = new Map<string, { g: number; cost: number }>();
  const weekMap = new Map<
    string,
    { g: number; cost: number; ions: ReturnType<typeof computeAddedIonsMg>[] }
  >();

  for (const a of mineralAdditions) {
    const dt = new Date(a.dateTime);
    const ym = toISTDateString(dt).slice(0, 7);
    const prevM = monthMap.get(ym) ?? { g: 0, cost: 0 };
    monthMap.set(ym, { g: prevM.g + a.quantityG, cost: prevM.cost + a.costAtTime });

    const wk = getISTMondayKey(dt);
    const prevW = weekMap.get(wk) ?? { g: 0, cost: 0, ions: [] };
    prevW.g += a.quantityG;
    prevW.cost += a.costAtTime;
    prevW.ions.push(a.ionsMg);
    weekMap.set(wk, prevW);
  }

  const monthlyChemData: MonthlyChemicalChartPoint[] = Array.from(
    monthMap.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({
      monthLabel: formatMonthLabel(ym),
      kg: Math.round((v.g / 1000) * 100) / 100,
      cost: Math.round(v.cost * 100) / 100,
    }));

  const weeklyIonTotals: WeeklyIonRow[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([wk, v]) => ({
      weekKey: wk,
      weekLabel: `Week of ${formatDateIN(new Date(`${wk}T12:00:00+05:30`))}`,
      totalG: v.g,
      totalCost: Math.round(v.cost * 100) / 100,
      ionsMg: sumAddedIonsMg(v.ions),
    }));

  const systemLogs = systemLogsRaw.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    type: l.type,
    quantityLitres: l.quantityLitres,
    cost: l.cost !== null ? toNumber(l.cost) : null,
    notes: l.notes,
  }));

  return (
    <WaterManager
      initialTab={initialTab}
      openNewOnLoad={openNewOnLoad}
      defaultDateYmd={toISTDateString(now)}
      defaultDateTimeLocal={toISTDateTimeInput(now)}
      thresholds={{
        salinityMin: settings?.salinityMin ?? 18,
        salinityMax: settings?.salinityMax ?? 25,
        phMin: settings?.phMin ?? 7.6,
        phMax: settings?.phMax ?? 8.3,
        ammoniaMax: settings?.ammoniaMax ?? 0.25,
        nitriteMax: settings?.nitriteMax ?? 0.25,
        nitrateMax: settings?.nitrateMax ?? 40,
      }}
      lowMineralStockKg={settings?.lowMineralStockKg ?? 2}
      systemVolumeLitres={settings?.systemVolumeLitres ?? 5000}
      waterTests={waterTests}
      waterChanges={waterChanges}
      minerals={minerals}
      mineralAdditions={mineralAdditions}
      monthlyChemData={monthlyChemData}
      weeklyIonTotals={weeklyIonTotals}
      systemLogs={systemLogs}
    />
  );
}
