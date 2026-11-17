import { db } from "@/lib/db";
import { getLatestCrabWeightG } from "@/lib/crab-metrics";
import {
  getDefaultFeedSlotIST,
  getISTDayBounds,
  toISTDateString,
  toISTDateTimeInput,
  toNumber,
} from "@/lib/format";
import {
  DailyLogClient,
  type DailyFeedTypeOption,
  type DailyWaterTestRow,
} from "@/components/daily-log-client";

export const dynamic = "force-dynamic";

function sortByTrayThenCode<
  T extends { code: string; currentTray: { number: string } | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const an = a.currentTray ? Number.parseInt(a.currentTray.number, 10) : 999999;
    const bn = b.currentTray ? Number.parseInt(b.currentTray.number, 10) : 999999;
    if (an !== bn) return an - bn;
    return a.code.localeCompare(b.code);
  });
}

function serializeWaterTest(w: {
  id: string;
  dateTime: Date;
  salinityPpt: number | null;
  pH: number | null;
  ammoniaMgL: number | null;
  nitriteMgL: number | null;
  nitrateMgL: number | null;
  alkalinityMgL: number | null;
  temperatureC: number | null;
  dissolvedOxygenMgL: number | null;
  notes: string | null;
}): DailyWaterTestRow {
  return {
    id: w.id,
    dateTime: w.dateTime.toISOString(),
    salinityPpt: w.salinityPpt,
    pH: w.pH,
    ammoniaMgL: w.ammoniaMgL,
    nitriteMgL: w.nitriteMgL,
    nitrateMgL: w.nitrateMgL,
    alkalinityMgL: w.alkalinityMgL,
    temperatureC: w.temperatureC,
    dissolvedOxygenMgL: w.dissolvedOxygenMgL,
    notes: w.notes,
  };
}

export default async function DailyLogPage() {
  const now = new Date();
  const { start, end } = getISTDayBounds(now);

  const [
    latestWaterTestRaw,
    todayWaterTestsRaw,
    activeCrabsRaw,
    sickCrabsCount,
    openCrabsRaw,
    activeFeedTypesRaw,
    todayFeedLogsRaw,
    todayWeightLogsRaw,
    todayMoltLogsRaw,
  ] = await Promise.all([
    db.waterTest.findFirst({ orderBy: { dateTime: "desc" } }),
    db.waterTest.findMany({
      where: { dateTime: { gte: start, lte: end } },
      orderBy: { dateTime: "desc" },
    }),
    db.crab.findMany({
      where: { status: "ACTIVE" },
      include: {
        currentTray: { select: { number: true } },
        feedLogs: {
          where: { dateTime: { gte: start, lte: end } },
          select: { quantityG: true },
        },
      },
    }),
    db.crab.count({ where: { status: "SICK" } }),
    db.crab.findMany({
      where: { status: { in: ["ACTIVE", "SICK"] } },
      include: {
        currentTray: { select: { number: true } },
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
      },
    }),
    db.feedType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, costPerKg: true },
    }),
    db.feedLog.findMany({
      where: { dateTime: { gte: start, lte: end } },
      include: {
        crab: { select: { id: true, code: true } },
        feedType: { select: { id: true, name: true, costPerKg: true } },
      },
      orderBy: { dateTime: "desc" },
    }),
    db.weightLog.findMany({
      where: { date: { gte: start, lte: end } },
      include: { crab: { select: { id: true, code: true } } },
      orderBy: { date: "desc" },
    }),
    db.moltLog.findMany({
      where: { date: { gte: start, lte: end } },
      include: { crab: { select: { id: true, code: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  const activeCrabs = sortByTrayThenCode(activeCrabsRaw).map((c) => ({
    id: c.id,
    code: c.code,
    trayNumber: c.currentTray?.number ?? null,
    todayFeedG: c.feedLogs.reduce((sum, f) => sum + f.quantityG, 0),
  }));

  const openCrabs = sortByTrayThenCode(openCrabsRaw).map((c) => ({
    id: c.id,
    code: c.code,
    status: c.status as "ACTIVE" | "SICK",
    trayNumber: c.currentTray?.number ?? null,
    latestWeightG: getLatestCrabWeightG(
      c.initialWeightG,
      c.finalWeightG,
      c.weightLogs,
      c.moltLogs
    ),
  }));

  const feedTypes: DailyFeedTypeOption[] = activeFeedTypesRaw.map((f) => ({
    id: f.id,
    name: f.name,
    costPerKg: toNumber(f.costPerKg),
  }));

  const editMap = new Map<string, DailyFeedTypeOption>(
    feedTypes.map((f) => [f.id, f])
  );
  for (const fl of todayFeedLogsRaw) {
    if (!editMap.has(fl.feedType.id)) {
      editMap.set(fl.feedType.id, {
        id: fl.feedType.id,
        name: `${fl.feedType.name} (inactive)`,
        costPerKg: toNumber(fl.feedType.costPerKg),
      });
    }
  }

  return (
    <DailyLogClient
      defaultDateYmd={toISTDateString(now)}
      defaultDateTimeLocal={toISTDateTimeInput(now)}
      defaultSlot={getDefaultFeedSlotIST(now)}
      latestWaterTest={latestWaterTestRaw ? serializeWaterTest(latestWaterTestRaw) : null}
      activeCrabs={activeCrabs}
      sickCrabsCount={sickCrabsCount}
      openCrabs={openCrabs}
      feedTypes={feedTypes}
      editFeedTypes={Array.from(editMap.values())}
      todayLogs={{
        feedLogs: todayFeedLogsRaw.map((f) => ({
          id: f.id,
          crabId: f.crab.id,
          crabCode: f.crab.code,
          dateTime: f.dateTime.toISOString(),
          feedTypeId: f.feedTypeId,
          feedName: f.feedType.name,
          quantityG: f.quantityG,
          timeSlot: f.timeSlot,
          costAtTime: toNumber(f.costAtTime),
          notes: f.notes,
        })),
        weightLogs: todayWeightLogsRaw.map((w) => ({
          id: w.id,
          crabId: w.crab.id,
          crabCode: w.crab.code,
          date: w.date.toISOString(),
          weightG: w.weightG,
        })),
        moltLogs: todayMoltLogsRaw.map((m) => ({
          id: m.id,
          crabId: m.crab.id,
          crabCode: m.crab.code,
          date: m.date.toISOString(),
          stage: m.stage,
          weightAfterG: m.weightAfterG,
          notes: m.notes,
        })),
        waterTests: todayWaterTestsRaw.map(serializeWaterTest),
      }}
    />
  );
}
