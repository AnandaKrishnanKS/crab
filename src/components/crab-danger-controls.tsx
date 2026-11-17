"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCrabAction, deleteSaleAction } from "@/app/actions/logs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TypedConfirmDeleteDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function CrabDangerControls({
  crabId,
  crabCode,
  sale,
  lastTray,
  emptyTrays,
  counts,
}: {
  crabId: string;
  crabCode: string;
  sale: { id: string; buyerName: string; totalAmountLabel: string } | null;
  lastTray: { id: string; number: string; isFreeAndActive: boolean; heldByCode: string | null } | null;
  emptyTrays: Array<{ id: string; number: string; isTreatmentTray: boolean }>;
  counts: {
    feedLogs: number;
    weightLogs: number;
    moltLogs: number;
    treatmentLogs: number;
    assignments: number;
  };
}) {
  const router = useRouter();
  const [undoOpen, setUndoOpen] = React.useState(false);
  const defaultTrayId =
    lastTray?.isFreeAndActive
      ? lastTray.id
      : (emptyTrays.find((t) => !t.isTreatmentTray) ?? emptyTrays[0])?.id ?? "";
  const [targetTrayId, setTargetTrayId] = React.useState(defaultTrayId);
  const [undoPending, setUndoPending] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);

  const warningItems: string[] = [];
  if (counts.assignments > 0) warningItems.push(`${counts.assignments} tray assignment record(s)`);
  if (counts.feedLogs > 0) warningItems.push(`${counts.feedLogs} feeding log(s)`);
  if (counts.weightLogs > 0) warningItems.push(`${counts.weightLogs} weight log(s)`);
  if (counts.moltLogs > 0) warningItems.push(`${counts.moltLogs} molt log(s)`);
  if (counts.treatmentLogs > 0) warningItems.push(`${counts.treatmentLogs} treatment log(s)`);
  if (sale) warningItems.push(`1 sale record (${sale.totalAmountLabel})`);
  if (warningItems.length === 0) warningItems.push("Crab master record (code cannot be reused)");

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-900 text-base">
          Recovery &amp; Danger Zone
        </CardTitle>
        <CardDescription>
          Reverse a mistaken sale or permanently delete a crab entered by mistake.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {sale && (
          <Button variant="outline" onClick={() => setUndoOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Delete Sale &amp; Revert to ACTIVE
          </Button>
        )}
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Permanently Delete Crab {crabCode}
        </Button>
      </CardContent>

      {sale && (
        <Dialog
          open={undoOpen}
          onOpenChange={setUndoOpen}
          title={`Delete Sale for ${crabCode}?`}
          description={`Removes the sale (${sale.totalAmountLabel} to ${sale.buyerName}), returns ${crabCode} to ACTIVE, and places it back in an active tray.`}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setUndoPending(true);
              const res = await deleteSaleAction({
                saleId: sale.id,
                targetTrayId,
              });
              setUndoPending(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Sale deleted");
              setUndoOpen(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            {lastTray && !lastTray.isFreeAndActive && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                Previous Tray {lastTray.number} is{" "}
                {lastTray.heldByCode
                  ? `occupied by crab ${lastTray.heldByCode}`
                  : "inactive"}
                . Pick another empty active tray below:
              </div>
            )}

            {emptyTrays.length === 0 ? (
              <p className="text-sm font-semibold text-red-700">
                No empty active trays are available right now. Free or add a tray first.
              </p>
            ) : (
              <div>
                <Label htmlFor="ds-tray">Place {crabCode} into Tray *</Label>
                <Select
                  id="ds-tray"
                  value={targetTrayId}
                  onChange={(e) => setTargetTrayId(e.target.value)}
                  required
                >
                  {emptyTrays.map((t) => (
                    <option key={t.id} value={t.id}>
                      Tray {t.number}
                      {lastTray?.id === t.id
                        ? " (Previous tray — free)"
                        : t.isTreatmentTray
                        ? " (Treatment tray)"
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUndoOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={undoPending || emptyTrays.length === 0}
              >
                {undoPending ? "Reverting..." : "Delete Sale & Revert ACTIVE"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      <TypedConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Permanently delete Crab ${crabCode}?`}
        requiredText={crabCode}
        warningItems={warningItems}
        recommendation="Recommended: Mark the crab DEAD or SOLD instead so tray history and costs stay accurate."
        pending={deletePending}
        onConfirm={async () => {
          setDeletePending(true);
          const res = await deleteCrabAction({
            crabId,
            confirmCode: crabCode,
          });
          setDeletePending(false);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.message ?? `Crab ${crabCode} deleted`);
          setDeleteOpen(false);
          router.push("/crabs");
          router.refresh();
        }}
      />
    </Card>
  );
}

