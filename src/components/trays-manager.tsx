"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Edit3, History, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTrayAction,
  toggleTrayActiveAction,
  upsertTrayAction,
} from "@/app/actions/master-data";
import { SafeDeleteDialog } from "@/components/safe-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TrayRow {
  id: string;
  number: string;
  isTreatmentTray: boolean;
  active: boolean;
  notes: string | null;
  assignmentCount: number;
  currentCrab: {
    id: string;
    code: string;
    status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  } | null;
}

export function TraysManager({ trays }: { trays: TrayRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TrayRow | null>(null);
  const [number, setNumber] = React.useState("");
  const [isTreatmentTray, setIsTreatmentTray] = React.useState(false);
  const [active, setActive] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TrayRow | null>(null);
  const [blockedMsg, setBlockedMsg] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const openCreate = () => {
    const nextNum =
      trays.reduce((max, t) => Math.max(max, Number.parseInt(t.number, 10) || 0), 0) + 1;
    setEditing(null);
    setNumber(nextNum < 100 ? String(nextNum).padStart(2, "0") : String(nextNum));
    setIsTreatmentTray(false);
    setActive(true);
    setNotes("");
    setFormOpen(true);
  };

  const openEdit = (tray: TrayRow) => {
    setEditing(tray);
    setNumber(tray.number);
    setIsTreatmentTray(tray.isTreatmentTray);
    setActive(tray.active);
    setNotes(tray.notes ?? "");
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await upsertTrayAction({
      id: editing?.id,
      number,
      isTreatmentTray,
      active,
      notes,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? `Tray ${res.data?.number} updated` : `Tray ${res.data?.number} added`);
    setFormOpen(false);
    router.refresh();
  };

  const handleToggleActive = async (tray: TrayRow) => {
    const res = await toggleTrayActiveAction(tray.id, !tray.active);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Tray ${tray.number} ${tray.active ? "deactivated" : "activated"}`);
    router.refresh();
  };

  const openDelete = (tray: TrayRow) => {
    setDeleteTarget(tray);
    setBlockedMsg(
      tray.assignmentCount > 0 && !tray.currentCrab
        ? `Tray ${tray.number} has ${tray.assignmentCount} historical assignment${tray.assignmentCount === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`
        : null
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res = await deleteTrayAction(deleteTarget.id);
    setDeletePending(false);
    if (!res.ok) {
      if (res.blockedByHistory) {
        setBlockedMsg(res.error);
      } else {
        toast.error(res.error);
      }
      return;
    }
    toast.success(`Tray ${deleteTarget.number} deleted`);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleDeactivateFromDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res = await toggleTrayActiveAction(deleteTarget.id, false);
    setDeletePending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Tray ${deleteTarget.number} deactivated`);
    setDeleteTarget(null);
    router.refresh();
  };

  const activeCount = trays.filter((t) => t.active).length;
  const occupiedCount = trays.filter((t) => t.currentCrab !== null).length;
  const emptyCount = trays.filter((t) => t.active && t.currentCrab === null).length;
  const treatmentCount = trays.filter((t) => t.active && t.isTreatmentTray).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trays</h1>
          <p className="text-sm text-slate-600">
            Fixed boxes numbered 01+. One crab per tray; full history stays on each tray.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Tray
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Active Trays</div>
            <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Empty (Ready)</div>
            <div className="text-2xl font-bold text-teal-800">{emptyCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Occupied</div>
            <div className="text-2xl font-bold text-slate-900">{occupiedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Treatment Trays</div>
            <div className="text-2xl font-bold text-amber-700">{treatmentCount}</div>
          </CardContent>
        </Card>
      </div>

      {trays.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            No trays yet. Tap &quot;Add Tray&quot; to create Tray 01.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trays.map((tray) => {
            const occupied = tray.currentCrab !== null;
            const sick = tray.currentCrab?.status === "SICK";
            return (
              <Card
                key={tray.id}
                className={!tray.active ? "bg-slate-100/80 opacity-85" : undefined}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-11 w-12 items-center justify-center rounded-lg border text-lg font-extrabold font-mono ${
                          !tray.active
                            ? "border-slate-300 bg-slate-200 text-slate-600"
                            : sick
                            ? "border-red-300 bg-red-50 text-red-900"
                            : occupied
                            ? "border-teal-300 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {tray.number}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={
                              !tray.active
                                ? "default"
                                : sick
                                ? "danger"
                                : occupied
                                ? "teal"
                                : "default"
                            }
                          >
                            {occupied ? "OCCUPIED" : "EMPTY"}
                          </Badge>
                          {tray.isTreatmentTray && (
                            <Badge variant="warning">
                              <ShieldAlert className="h-3 w-3" />
                              Treatment
                            </Badge>
                          )}
                          {!tray.active && <Badge variant="default">Inactive</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {tray.currentCrab ? (
                            <span>
                              Crab{" "}
                              <Link
                                href={`/crabs/${tray.currentCrab.id}`}
                                className="font-bold text-teal-800 underline underline-offset-2"
                              >
                                {tray.currentCrab.code}
                              </Link>{" "}
                              ({tray.currentCrab.status})
                            </span>
                          ) : (
                            <span>Ready for next crab</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {tray.notes && (
                    <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                      {tray.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                    <Link
                      href={`/trays/${tray.id}`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <History className="h-3.5 w-3.5" />
                      History ({tray.assignmentCount})
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(tray)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(tray)}
                    >
                      {tray.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => openDelete(tray)}
                      aria-label={`Delete tray ${tray.number}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Edit Tray ${editing.number}` : "Add Tray"}
        description="Tray numbers are zero-padded to 2 digits (01–99, 100+)."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="tray-number">Tray Number *</Label>
            <Input
              id="tray-number"
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="e.g. 13 or 101"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Digits only. 1 becomes 01; 100 stays 100.
            </p>
          </div>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTreatmentTray}
              onChange={(e) => setIsTreatmentTray(e.target.checked)}
              className="h-5 w-5 accent-teal-700"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Treatment tray (quarantine / sick crabs)
              </div>
              <div className="text-xs text-slate-600">
                Highlighted when moving sick crabs for isolation
              </div>
            </div>
          </label>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5 accent-teal-700"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Active</div>
              <div className="text-xs text-slate-600">
                Inactive trays stay in history but are hidden from new stocking
              </div>
            </div>
          </label>

          <div>
            <Label htmlFor="tray-notes">Notes (optional)</Label>
            <Textarea
              id="tray-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Valve position, rack tier, lid repair..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Box className="h-4 w-4" />
              {submitting ? "Saving..." : editing ? "Save Tray" : "Create Tray"}
            </Button>
          </div>
        </form>
      </Dialog>

      <SafeDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        entityLabel="tray"
        itemName={deleteTarget ? `Tray ${deleteTarget.number}` : ""}
        blockedMessage={blockedMsg}
        canDeactivate={Boolean(deleteTarget?.active)}
        pending={deletePending}
        onDelete={handleConfirmDelete}
        onDeactivate={handleDeactivateFromDelete}
      />
    </div>
  );
}

