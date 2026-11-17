import { db } from "@/lib/db";
import { computeCrabMetrics } from "@/lib/crab-metrics";
import { getCrabReferenceOptions } from "@/lib/crab-context";
import { formatDateIN, toISTDateString, toNumber } from "@/lib/format";
import {
  type BatchOption,
  type CrabListItem,
  CrabsList,
} from "@/components/crabs-list";

export const dynamic = "force-dynamic";

export default async function CrabsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; tab?: string }>;
}) {
  const [resolvedParams, rawCrabs, rawBatches, settings, refs] = await Promise.all([
    searchParams,
    db.crab.findMany({
      include: {
        batch: { select: { letter: true } },
        currentTray: { select: { id: true, number: true } },
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
        crabs: {
          select: {
            status: true,
            _count: {
              select: {
                feedLogs: true,
                weightLogs: true,
                moltLogs: true,
                treatmentLogs: true,
                assignments: true,
              },
            },
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    }),
    db.settings.findUnique({ where: { id: 1 } }),
    getCrabReferenceOptions(),
  ]);

  const now = new Date();
  const crabs: CrabListItem[] = rawCrabs.map((c) => {
    const m = computeCrabMetrics(c, now);
    return {
      id: c.id,
      code: c.code,
      batchLetter: c.batch.letter,
      sex: c.sex,
      status: c.status,
      trayId: c.currentTray?.id ?? null,
      trayNumber: c.currentTray?.number ?? null,
      daysInSystem: m.daysInSystem,
      initialWeightG: c.initialWeightG,
      latestWeightG: m.latestWeightG,
      weightGainG: m.weightGainG,
      profit: m.profit,
    };
  });

  const batches: BatchOption[] = rawBatches.map((b) => {
    const crabCount = b.crabs.length;
    const openCrabCount = b.crabs.filter(
      (c) => c.status === "ACTIVE" || c.status === "SICK"
    ).length;
    const logCount = b.crabs.reduce(
      (sum, c) =>
        sum +
        c._count.feedLogs +
        c._count.weightLogs +
        c._count.moltLogs +
        c._count.treatmentLogs +
        c._count.assignments,
      0
    );
    return {
      id: b.id,
      letter: b.letter,
      nextCrabSeq: b.nextCrabSeq,
      supplierName: b.supplier.name,
      purchaseDateLabel: formatDateIN(b.purchaseDate),
      pricePerKg: b.pricePerKg !== null ? toNumber(b.pricePerKg) : null,
      crabCount,
      openCrabCount,
      logCount,
    };
  });

  const targetDays = settings?.targetFatteningDays ?? 45;
  const defaultDateYmd = toISTDateString(now);
  const defaultExpectedHarvest = toISTDateString(
    new Date(now.getTime() + targetDays * 24 * 60 * 60 * 1000)
  );

  return (
    <CrabsList
      crabs={crabs}
      batches={batches}
      emptyTrays={refs.emptyTrays}
      defaultDateYmd={defaultDateYmd}
      defaultExpectedHarvest={defaultExpectedHarvest}
      initialBatchFilter={resolvedParams.batch ?? "ALL"}
      initialTab={resolvedParams.tab === "batches" ? "batches" : "crabs"}
    />
  );
}
