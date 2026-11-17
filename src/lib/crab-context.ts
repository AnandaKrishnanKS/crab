import { db } from "@/lib/db";
import { computeCrabMetrics } from "@/lib/crab-metrics";
import {
  getDefaultFeedSlotIST,
  toISTDateString,
  toISTDateTimeInput,
  toNumber,
} from "@/lib/format";
import type { CrabActionContextData } from "@/components/crab-action-modals";

export async function getCrabReferenceOptions() {
  const [emptyTraysRaw, suppliers, buyers, feedTypesRaw] = await Promise.all([
    db.tray.findMany({
      where: { active: true, currentCrab: null },
      select: { id: true, number: true, isTreatmentTray: true },
    }),
    db.supplier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.buyer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.feedType.findMany({
      where: { active: true },
      select: { id: true, name: true, costPerKg: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const emptyTrays = emptyTraysRaw.sort(
    (a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10)
  );
  const feedTypes = feedTypesRaw.map((f) => ({
    id: f.id,
    name: f.name,
    costPerKg: toNumber(f.costPerKg),
  }));

  return { emptyTrays, suppliers, buyers, feedTypes };
}

export async function buildCrabActionContext(crabId: string): Promise<CrabActionContextData | null> {
  const [crab, refs] = await Promise.all([
    db.crab.findUnique({
      where: { id: crabId },
      include: {
        batch: {
          include: {
            _count: { select: { crabs: true } },
          },
        },
        currentTray: { select: { id: true, number: true } },
        assignments: {
          orderBy: { fromDate: "desc" },
          include: { tray: { select: { id: true, isTreatmentTray: true } } },
        },
        weightLogs: true,
        moltLogs: true,
        feedLogs: true,
        treatmentLogs: true,
        sale: true,
      },
    }),
    getCrabReferenceOptions(),
  ]);

  if (!crab) return null;

  const metrics = computeCrabMetrics(crab);
  const prevNonTreatment = crab.assignments.find(
    (a) => a.toDate !== null && !a.tray.isTreatmentTray
  );

  // Ensure current supplier is present in select even if deactivated
  const suppliers = refs.suppliers.some((s) => s.id === crab.batch.supplierId)
    ? refs.suppliers
    : [
        ...(await db.supplier.findMany({
          where: { id: crab.batch.supplierId },
          select: { id: true, name: true },
        })),
        ...refs.suppliers,
      ];

  const now = new Date();
  return {
    crab: {
      id: crab.id,
      code: crab.code,
      batchLetter: crab.batch.letter,
      batchCrabCount: crab.batch._count.crabs,
      status: crab.status,
      currentTrayId: crab.currentTrayId,
      currentTrayNumber: crab.currentTray?.number ?? null,
      previousNonTreatmentTrayId: prevNonTreatment?.tray.id ?? null,
      sex: crab.sex,
      initialWeightG: crab.initialWeightG,
      latestWeightG: metrics.latestWeightG,
      purchaseCost: toNumber(crab.purchaseCost),
      stockedDateYmd: toISTDateString(crab.stockedDate),
      expectedHarvestDateYmd: crab.expectedHarvestDate
        ? toISTDateString(crab.expectedHarvestDate)
        : "",
      supplierId: crab.batch.supplierId,
      notes: crab.notes,
    },
    emptyTrays: refs.emptyTrays,
    suppliers,
    buyers: refs.buyers,
    feedTypes: refs.feedTypes,
    defaultSlot: getDefaultFeedSlotIST(now),
    defaultDateYmd: toISTDateString(now),
    defaultDateTimeLocal: toISTDateTimeInput(now),
  };
}

