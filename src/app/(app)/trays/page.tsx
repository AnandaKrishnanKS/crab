import { db } from "@/lib/db";
import { TraysManager, type TrayRow } from "@/components/trays-manager";

export const dynamic = "force-dynamic";

export default async function TraysPage() {
  const rawTrays = await db.tray.findMany({
    include: {
      currentCrab: {
        select: { id: true, code: true, status: true },
      },
      _count: {
        select: { assignments: true },
      },
    },
  });

  const trays: TrayRow[] = rawTrays
    .sort((a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10))
    .map((t) => ({
      id: t.id,
      number: t.number,
      isTreatmentTray: t.isTreatmentTray,
      active: t.active,
      notes: t.notes,
      assignmentCount: t._count.assignments,
      currentCrab: t.currentCrab,
    }));

  return <TraysManager trays={trays} />;
}
