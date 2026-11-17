import { db } from "@/lib/db";
import { indexToBatchLetter } from "@/lib/batch";
import { getCrabReferenceOptions } from "@/lib/crab-context";
import { toISTDateString } from "@/lib/format";
import { BatchWizard } from "@/components/batch-wizard";

export const dynamic = "force-dynamic";

export default async function NewBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ trayId?: string }>;
}) {
  const [resolvedParams, settings, refs] = await Promise.all([
    searchParams,
    db.settings.findUnique({ where: { id: 1 } }),
    getCrabReferenceOptions(),
  ]);

  const nextBatchIndex = settings?.nextBatchIndex ?? 0;
  const targetFatteningDays = settings?.targetFatteningDays ?? 45;
  const nextLetter = indexToBatchLetter(nextBatchIndex);

  const now = new Date();
  const defaultPurchaseDate = toISTDateString(now);
  const defaultExpectedHarvest = toISTDateString(
    new Date(now.getTime() + targetFatteningDays * 24 * 60 * 60 * 1000)
  );

  return (
    <BatchWizard
      nextLetter={nextLetter}
      suppliers={refs.suppliers}
      emptyTrays={refs.emptyTrays}
      defaultPurchaseDate={defaultPurchaseDate}
      defaultExpectedHarvest={defaultExpectedHarvest}
      preselectedTrayId={resolvedParams.trayId}
    />
  );
}
