"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFeedLogAction,
  deleteMoltLogAction,
  deleteTreatmentLogAction,
  deleteWeightLogAction,
  updateFeedLogAction,
  updateMoltLogAction,
  updateTreatmentLogAction,
  updateWeightLogAction,
} from "@/app/actions/logs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateIN,
  formatDateTimeIN,
  formatINR,
  formatNumberIN,
  toISTDateString,
  toISTDateTimeInput,
} from "@/lib/format";

export interface FeedTypeOption {
  id: string;
  name: string;
  costPerKg: number;
}

export interface CrabDetailLogsData {
  feedLogs: Array<{
    id: string;
    dateTime: string;
    feedTypeId: string;
    feedName: string;
    quantityG: number;
    timeSlot: "MORNING" | "EVENING" | "NIGHT";
    costAtTime: number;
    notes: string | null;
  }>;
  weightLogs: Array<{
    id: string;
    date: string;
    weightG: number;
  }>;
  moltLogs: Array<{
    id: string;
    date: string;
    stage: "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD";
    weightAfterG: number | null;
    notes: string | null;
  }>;
  treatmentLogs: Array<{
    id: string;
    date: string;
    symptoms: string;
    diagnosis: string | null;
    treatment: string;
    dose: string | null;
    cost: number;
    outcome: "ONGOING" | "RECOVERED" | "DIED";
    notes: string | null;
  }>;
  assignments: Array<{
    id: string;
    trayId: string;
    trayNumber: string;
    fromDate: string;
    toDate: string | null;
    days: number;
    reason: string;
  }>;
}

type DeleteTarget =
  | null
  | { kind: "feed"; id: string; label: string }
  | { kind: "weight"; id: string; label: string }
  | { kind: "molt"; id: string; label: string }
  | { kind: "treatment"; id: string; label: string };

export function CrabDetailTabs({
  logs,
  feedTypes,
}: {
  logs: CrabDetailLogsData;
  feedTypes: FeedTypeOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<
    "feed" | "weights" | "molts" | "treatments" | "trays"
  >("feed");
  const [pending, setPending] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget>(null);

  // Edit feed state
  const [editFeed, setEditFeed] = React.useState<{
    id: string;
    dateTime: string;
    feedTypeId: string;
    quantityG: string;
    timeSlot: "MORNING" | "EVENING" | "NIGHT";
    costAtTime: string;
    notes: string;
  } | null>(null);

  // Edit weight state
  const [editWeight, setEditWeight] = React.useState<{
    id: string;
    date: string;
    weightG: string;
  } | null>(null);

  // Edit molt state
  const [editMolt, setEditMolt] = React.useState<{
    id: string;
    date: string;
    stage: "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD";
    weightAfterG: string;
    notes: string;
  } | null>(null);

  // Edit treatment state
  const [editTreat, setEditTreat] = React.useState<{
    id: string;
    date: string;
    symptoms: string;
    diagnosis: string;
    treatment: string;
    dose: string;
    cost: string;
    outcome: "ONGOING" | "RECOVERED" | "DIED";
    notes: string;
  } | null>(null);

  const feedChoices = React.useMemo(() => {
    const map = new Map(feedTypes.map((f) => [f.id, f]));
    for (const f of logs.feedLogs) {
      if (!map.has(f.feedTypeId)) {
        map.set(f.feedTypeId, {
          id: f.feedTypeId,
          name: f.feedName,
          costPerKg: 0,
        });
      }
    }
    return Array.from(map.values());
  }, [feedTypes, logs.feedLogs]);

  const recalcFeedCost = (ftId: string, qtyStr: string): string | null => {
    const ft = feedTypes.find((x) => x.id === ftId);
    const qty = Number(qtyStr);
    if (!ft || !Number.isFinite(qty) || qty <= 0) return null;
    return String(Math.round((qty / 1000) * ft.costPerKg * 100) / 100);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setPending(true);
    const res =
      deleteTarget.kind === "feed"
        ? await deleteFeedLogAction(deleteTarget.id)
        : deleteTarget.kind === "weight"
        ? await deleteWeightLogAction(deleteTarget.id)
        : deleteTarget.kind === "molt"
        ? await deleteMoltLogAction(deleteTarget.id)
        : await deleteTreatmentLogAction(deleteTarget.id);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Deleted");
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "feed", label: "Feed", count: logs.feedLogs.length },
          { id: "weights", label: "Weights", count: logs.weightLogs.length },
          { id: "molts", label: "Molts", count: logs.moltLogs.length },
          { id: "treatments", label: "Treatments", count: logs.treatmentLogs.length },
          { id: "trays", label: "Trays", count: logs.assignments.length },
        ]}
      />

      <Card>
        <CardContent className="p-4">
          {tab === "feed" && (
            logs.feedLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No feed logs yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.feedLogs.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {f.feedName} • {formatNumberIN(f.quantityG, 1)} g
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatDateTimeIN(f.dateTime)} • {f.timeSlot}
                      </div>
                      {f.notes && (
                        <div className="text-xs text-slate-500 mt-0.5">{f.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-slate-900 mr-1">
                        {formatINR(f.costAtTime)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit feed log ${f.id}`}
                        onClick={() =>
                          setEditFeed({
                            id: f.id,
                            dateTime: toISTDateTimeInput(new Date(f.dateTime)),
                            feedTypeId: f.feedTypeId,
                            quantityG: String(f.quantityG),
                            timeSlot: f.timeSlot,
                            costAtTime: String(f.costAtTime),
                            notes: f.notes ?? "",
                          })
                        }
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-label={`Delete feed log ${f.id}`}
                        onClick={() =>
                          setDeleteTarget({
                            kind: "feed",
                            id: f.id,
                            label: `${f.feedName} (${f.quantityG} g)`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "weights" && (
            logs.weightLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No weight logs yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.weightLogs.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <span className="text-slate-700">{formatDateIN(w.date)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 mr-1">
                        {formatNumberIN(w.weightG, 0)} g
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit weight log ${w.id}`}
                        onClick={() =>
                          setEditWeight({
                            id: w.id,
                            date: toISTDateString(new Date(w.date)),
                            weightG: String(w.weightG),
                          })
                        }
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-label={`Delete weight log ${w.id}`}
                        onClick={() =>
                          setDeleteTarget({
                            kind: "weight",
                            id: w.id,
                            label: `${w.weightG} g on ${formatDateIN(w.date)}`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "molts" && (
            logs.moltLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No molt logs yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.moltLogs.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            m.stage === "SOFT" || m.stage === "MOLTED"
                              ? "warning"
                              : m.stage === "HARD"
                              ? "success"
                              : "default"
                          }
                        >
                          {m.stage}
                        </Badge>
                        <span className="text-xs text-slate-600">
                          {formatDateIN(m.date)}
                        </span>
                      </div>
                      {m.notes && (
                        <div className="text-xs text-slate-600 mt-1">{m.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-semibold text-slate-900 mr-1">
                        {m.weightAfterG !== null
                          ? `${formatNumberIN(m.weightAfterG, 0)} g`
                          : "—"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit molt log ${m.id}`}
                        onClick={() =>
                          setEditMolt({
                            id: m.id,
                            date: toISTDateString(new Date(m.date)),
                            stage: m.stage,
                            weightAfterG:
                              m.weightAfterG !== null ? String(m.weightAfterG) : "",
                            notes: m.notes ?? "",
                          })
                        }
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-label={`Delete molt log ${m.id}`}
                        onClick={() =>
                          setDeleteTarget({
                            kind: "molt",
                            id: m.id,
                            label: `${m.stage} on ${formatDateIN(m.date)}`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "treatments" && (
            logs.treatmentLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No treatment logs.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.treatmentLogs.map((t) => (
                  <div key={t.id} className="py-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            t.outcome === "ONGOING"
                              ? "danger"
                              : t.outcome === "RECOVERED"
                              ? "success"
                              : "default"
                          }
                        >
                          {t.outcome}
                        </Badge>
                        <span className="text-xs text-slate-600">
                          {formatDateIN(t.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 mr-1">
                          {formatINR(t.cost)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit treatment log ${t.id}`}
                          onClick={() =>
                            setEditTreat({
                              id: t.id,
                              date: toISTDateString(new Date(t.date)),
                              symptoms: t.symptoms,
                              diagnosis: t.diagnosis ?? "",
                              treatment: t.treatment,
                              dose: t.dose ?? "",
                              cost: String(t.cost),
                              outcome: t.outcome,
                              notes: t.notes ?? "",
                            })
                          }
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          aria-label={`Delete treatment log ${t.id}`}
                          onClick={() =>
                            setDeleteTarget({
                              kind: "treatment",
                              id: t.id,
                              label: `${t.treatment} on ${formatDateIN(t.date)}`,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {t.treatment} {t.dose ? `(${t.dose})` : ""}
                    </div>
                    <div className="text-xs text-slate-700">
                      Symptoms: {t.symptoms}
                      {t.diagnosis ? ` • Diagnosis: ${t.diagnosis}` : ""}
                    </div>
                    {t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "trays" && (
            logs.assignments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No tray history.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-bold">
                        <Link
                          href={`/trays/${a.trayId}`}
                          className="text-teal-800 underline underline-offset-2"
                        >
                          Tray {a.trayNumber}
                        </Link>{" "}
                        <span className="text-xs font-normal text-slate-600">
                          ({a.reason})
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatDateIN(a.fromDate)} →{" "}
                        {a.toDate ? formatDateIN(a.toDate) : "Present"}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {a.days} d
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Edit Feed Dialog */}
      <Dialog
        open={Boolean(editFeed)}
        onOpenChange={(o) => !o && setEditFeed(null)}
        title="Edit Feed Log"
      >
        {editFeed && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const res = await updateFeedLogAction({
                id: editFeed.id,
                dateTime: editFeed.dateTime,
                feedTypeId: editFeed.feedTypeId,
                quantityG: Number(editFeed.quantityG),
                timeSlot: editFeed.timeSlot,
                costAtTime: Number(editFeed.costAtTime),
                notes: editFeed.notes,
              });
              setPending(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Updated");
              setEditFeed(null);
              router.refresh();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ef-dt">Date &amp; Time</Label>
                <Input
                  id="ef-dt"
                  type="datetime-local"
                  value={editFeed.dateTime}
                  onChange={(e) =>
                    setEditFeed((prev) => prev && { ...prev, dateTime: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="ef-slot">Slot</Label>
                <Select
                  id="ef-slot"
                  value={editFeed.timeSlot}
                  onChange={(e) =>
                    setEditFeed(
                      (prev) =>
                        prev && {
                          ...prev,
                          timeSlot: e.target.value as "MORNING" | "EVENING" | "NIGHT",
                        }
                    )
                  }
                >
                  <option value="MORNING">MORNING</option>
                  <option value="EVENING">EVENING</option>
                  <option value="NIGHT">NIGHT</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ef-type">Feed Type</Label>
                <Select
                  id="ef-type"
                  value={editFeed.feedTypeId}
                  onChange={(e) => {
                    const nextFt = e.target.value;
                    const nextCost = recalcFeedCost(nextFt, editFeed.quantityG);
                    setEditFeed((prev) =>
                      prev
                        ? {
                            ...prev,
                            feedTypeId: nextFt,
                            costAtTime: nextCost ?? prev.costAtTime,
                          }
                        : null
                    );
                  }}
                >
                  {feedChoices.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ef-qty">Qty (g)</Label>
                <Input
                  id="ef-qty"
                  type="number"
                  step="any"
                  min="0.1"
                  value={editFeed.quantityG}
                  onChange={(e) => {
                    const nextQty = e.target.value;
                    const nextCost = recalcFeedCost(editFeed.feedTypeId, nextQty);
                    setEditFeed((prev) =>
                      prev
                        ? {
                            ...prev,
                            quantityG: nextQty,
                            costAtTime: nextCost ?? prev.costAtTime,
                          }
                        : null
                    );
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ef-cost">Cost (₹)</Label>
                <Input
                  id="ef-cost"
                  type="number"
                  step="any"
                  min="0"
                  value={editFeed.costAtTime}
                  onChange={(e) =>
                    setEditFeed(
                      (prev) => prev && { ...prev, costAtTime: e.target.value }
                    )
                  }
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ef-notes">Notes</Label>
              <Input
                id="ef-notes"
                value={editFeed.notes}
                onChange={(e) =>
                  setEditFeed((prev) => prev && { ...prev, notes: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditFeed(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Edit Weight Dialog */}
      <Dialog
        open={Boolean(editWeight)}
        onOpenChange={(o) => !o && setEditWeight(null)}
        title="Edit Weight Log"
      >
        {editWeight && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const res = await updateWeightLogAction({
                id: editWeight.id,
                date: editWeight.date,
                weightG: Number(editWeight.weightG),
              });
              setPending(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Updated");
              setEditWeight(null);
              router.refresh();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="ew-date">Date</Label>
              <Input
                id="ew-date"
                type="date"
                value={editWeight.date}
                onChange={(e) =>
                  setEditWeight((prev) => prev && { ...prev, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="ew-g">Weight (g)</Label>
              <Input
                id="ew-g"
                type="number"
                step="any"
                min="1"
                value={editWeight.weightG}
                onChange={(e) =>
                  setEditWeight((prev) => prev && { ...prev, weightG: e.target.value })
                }
                required
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditWeight(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Weight"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Edit Molt Dialog */}
      <Dialog
        open={Boolean(editMolt)}
        onOpenChange={(o) => !o && setEditMolt(null)}
        title="Edit Molt Log"
      >
        {editMolt && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const res = await updateMoltLogAction({
                id: editMolt.id,
                date: editMolt.date,
                stage: editMolt.stage,
                weightAfterG: editMolt.weightAfterG || null,
                notes: editMolt.notes,
              });
              setPending(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Updated");
              setEditMolt(null);
              router.refresh();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="em-date">Date</Label>
                <Input
                  id="em-date"
                  type="date"
                  value={editMolt.date}
                  onChange={(e) =>
                    setEditMolt((prev) => prev && { ...prev, date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="em-stage">Stage</Label>
                <Select
                  id="em-stage"
                  value={editMolt.stage}
                  onChange={(e) =>
                    setEditMolt(
                      (prev) =>
                        prev && {
                          ...prev,
                          stage: e.target.value as typeof prev.stage,
                        }
                    )
                  }
                >
                  <option value="PRE_MOLT">PRE_MOLT</option>
                  <option value="MOLTED">MOLTED</option>
                  <option value="SOFT">SOFT</option>
                  <option value="HARDENING">HARDENING</option>
                  <option value="HARD">HARD</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="em-wt">Weight After (g, optional)</Label>
              <Input
                id="em-wt"
                type="number"
                step="any"
                min="1"
                value={editMolt.weightAfterG}
                onChange={(e) =>
                  setEditMolt((prev) => prev && { ...prev, weightAfterG: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="em-notes">Notes</Label>
              <Textarea
                id="em-notes"
                value={editMolt.notes}
                onChange={(e) =>
                  setEditMolt((prev) => prev && { ...prev, notes: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditMolt(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Molt"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Edit Treatment Dialog */}
      <Dialog
        open={Boolean(editTreat)}
        onOpenChange={(o) => !o && setEditTreat(null)}
        title="Edit Treatment Log"
      >
        {editTreat && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const res = await updateTreatmentLogAction({
                id: editTreat.id,
                date: editTreat.date,
                symptoms: editTreat.symptoms,
                diagnosis: editTreat.diagnosis,
                treatment: editTreat.treatment,
                dose: editTreat.dose,
                cost: Number(editTreat.cost || 0),
                outcome: editTreat.outcome,
                notes: editTreat.notes,
              });
              setPending(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Updated");
              setEditTreat(null);
              router.refresh();
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="et-date">Date</Label>
                <Input
                  id="et-date"
                  type="date"
                  value={editTreat.date}
                  onChange={(e) =>
                    setEditTreat((prev) => prev && { ...prev, date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="et-cost">Cost (₹)</Label>
                <Input
                  id="et-cost"
                  type="number"
                  step="any"
                  min="0"
                  value={editTreat.cost}
                  onChange={(e) =>
                    setEditTreat((prev) => prev && { ...prev, cost: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="et-out">Outcome</Label>
                <Select
                  id="et-out"
                  value={editTreat.outcome}
                  onChange={(e) =>
                    setEditTreat(
                      (prev) =>
                        prev && {
                          ...prev,
                          outcome: e.target.value as "ONGOING" | "RECOVERED" | "DIED",
                        }
                    )
                  }
                >
                  <option value="ONGOING">ONGOING</option>
                  <option value="RECOVERED">RECOVERED</option>
                  <option value="DIED">DIED</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="et-sym">Symptoms *</Label>
              <Input
                id="et-sym"
                value={editTreat.symptoms}
                onChange={(e) =>
                  setEditTreat((prev) => prev && { ...prev, symptoms: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="et-treat">Treatment *</Label>
              <Input
                id="et-treat"
                value={editTreat.treatment}
                onChange={(e) =>
                  setEditTreat((prev) => prev && { ...prev, treatment: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="et-diag">Diagnosis</Label>
                <Input
                  id="et-diag"
                  value={editTreat.diagnosis}
                  onChange={(e) =>
                    setEditTreat((prev) => prev && { ...prev, diagnosis: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="et-dose">Dose</Label>
                <Input
                  id="et-dose"
                  value={editTreat.dose}
                  onChange={(e) =>
                    setEditTreat((prev) => prev && { ...prev, dose: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="et-notes">Notes</Label>
              <Textarea
                id="et-notes"
                value={editTreat.notes}
                onChange={(e) =>
                  setEditTreat((prev) => prev && { ...prev, notes: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTreat(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Treatment"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.kind ?? "log"}`}
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.label}?`
            : undefined
        }
        pending={pending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
