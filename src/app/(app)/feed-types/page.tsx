import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import {
  FeedTypesManager,
  type CrabFeedCostRow,
  type FeedTypeRow,
} from "@/components/feed-types-manager";

export const dynamic = "force-dynamic";

export default async function FeedTypesPage() {
  const [rawFeedTypes, feedAggByType, feedAggByCrab, crabs] = await Promise.all([
    db.feedType.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.feedLog.groupBy({
      by: ["feedTypeId"],
      _sum: { quantityG: true, costAtTime: true },
      _count: { _all: true },
    }),
    db.feedLog.groupBy({
      by: ["crabId"],
      _sum: { quantityG: true, costAtTime: true },
      _count: { _all: true },
    }),
    db.crab.findMany({
      select: {
        id: true,
        code: true,
        status: true,
        batch: { select: { letter: true } },
      },
      orderBy: [{ batch: { letter: "asc" } }, { seq: "asc" }],
    }),
  ]);

  const typeMap = new Map(feedAggByType.map((row) => [row.feedTypeId, row]));
  const feedTypes: FeedTypeRow[] = rawFeedTypes.map((ft) => {
    const agg = typeMap.get(ft.id);
    return {
      id: ft.id,
      name: ft.name,
      costPerKg: toNumber(ft.costPerKg),
      active: ft.active,
      logCount: agg?._count._all ?? 0,
      totalQuantityG: agg?._sum.quantityG ?? 0,
      totalCost: toNumber(agg?._sum.costAtTime),
    };
  });

  const crabAggMap = new Map(feedAggByCrab.map((row) => [row.crabId, row]));
  const crabFeedCosts: CrabFeedCostRow[] = crabs.map((c) => {
    const agg = crabAggMap.get(c.id);
    return {
      crabId: c.id,
      code: c.code,
      batchLetter: c.batch.letter,
      status: c.status,
      logCount: agg?._count._all ?? 0,
      totalQuantityG: agg?._sum.quantityG ?? 0,
      totalCost: toNumber(agg?._sum.costAtTime),
    };
  });

  return (
    <FeedTypesManager feedTypes={feedTypes} crabFeedCosts={crabFeedCosts} />
  );
}
