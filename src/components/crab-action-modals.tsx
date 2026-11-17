"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Edit3,
  IndianRupee,
  Scale,
  Shell,
  Skull,
  Stethoscope,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  addTreatmentAction,
  markCrabDeadAction,
  markCrabRecoveredAction,
  markCrabSickAction,
  moveCrabTrayAction,
  sellCrabAction,
  updateCrabInitialDetailsAction,
} from "@/app/actions/crabs";
import {
  addFeedLogAction,
  addMoltLogAction,
  addWeightLogAction,
} from "@/app/actions/logs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";

export interface CrabActionContextData {
  crab: {
    id: string;
    code: string;
    batchLetter: string;
    batchCrabCount: number;
    status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
    currentTrayId: string | null;
    currentTrayNumber: string | null;
    previousNonTreatmentTrayId: string | null;
    sex: "MALE" | "FEMALE";
    initialWeightG: number;
    latestWeightG: number;
    purchaseCost: number;
    stockedDateYmd: string;
    expectedHarvestDateYmd: string;
    supplierId: string;
    notes: string | null;
  };
  emptyTrays: Array<{ id: string; number: string; isTreatmentTray: boolean }>;
  suppliers: Array<{ id: string; name: string }>;
  buyers: Array<{ id: string; name: string }>;
  feedTypes: Array<{ id: string; name: string; costPerKg: number }>;
  defaultSlot: "MORNING" | "EVENING" | "NIGHT";
  defaultDateYmd: string;
  defaultDateTimeLocal: string;
}

type ModalKind =
  | null
  | "feed"
  | "weight"
  | "molt"
  | "move"
  | "sick"
  | "treatment"
  | "recover"
  | "sell"
  | "dead"
  | "edit";

export function CrabActionModals({ data }: { data: CrabActionContextData }) {
  const router = useRouter();
  const { crab, emptyTrays, buyers, suppliers, feedTypes } = data;
  const [modal, setModal] = React.useState<ModalKind>(null);
  const [pending, setPending] = React.useState(false);

  // Feed state
  const [feedDateTime, setFeedDateTime] = React.useState(data.defaultDateTimeLocal);
  const [feedTypeId, setFeedTypeId] = React.useState(feedTypes[0]?.id ?? "");
  const [feedQtyG, setFeedQtyG] = React.useState("25");
  const [feedSlot, setFeedSlot] = React.useState<"MORNING" | "EVENING" | "NIGHT">(
    data.defaultSlot
  );
  const [feedNotes, setFeedNotes] = React.useState("");

  // Weight state
  const [weightDate, setWeightDate] = React.useState(data.defaultDateYmd);
  const [weightG, setWeightG] = React.useState(String(crab.latestWeightG));

  // Molt state
  const [moltDate, setMoltDate] = React.useState(data.defaultDateYmd);
  const [moltStage, setMoltStage] = React.useState<
    "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD"
  >("MOLTED");
  const [moltWeightAfter, setMoltWeightAfter] = React.useState("");
  const [moltNotes, setMoltNotes] = React.useState("");

  // Move state
  const defaultMoveTray = emptyTrays[0]?.id ?? "";
  const [moveTrayId, setMoveTrayId] = React.useState(defaultMoveTray);
  const [moveReason, setMoveReason] = React.useState<
    "MOVED_TO_TREATMENT" | "MOVED_BACK" | "MOVED_OTHER"
  >("MOVED_OTHER");
  const [moveDate, setMoveDate] = React.useState(data.defaultDateYmd);

  // Sick / Treatment state
  const treatmentTrays = emptyTrays.filter((t) => t.isTreatmentTray);
  const [treatDate, setTreatDate] = React.useState(data.defaultDateYmd);
  const [symptoms, setSymptoms] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [treatment, setTreatment] = React.useState("");
  const [dose, setDose] = React.useState("");
  const [treatCost, setTreatCost] = React.useState("0");
  const [treatOutcome, setTreatOutcome] = React.useState<
    "ONGOING" | "RECOVERED" | "DIED"
  >("ONGOING");
  const [treatNotes, setTreatNotes] = React.useState("");
  const [sickMoveTrayId, setSickMoveTrayId] = React.useState(
    treatmentTrays[0]?.id ?? ""
  );

  // Recover state
  const nonTreatmentEmpty = emptyTrays.filter((t) => !t.isTreatmentTray);
  const prevEmptyMatch = nonTreatmentEmpty.find(
    (t) => t.id === crab.previousNonTreatmentTrayId
  );
  const [recoverDate, setRecoverDate] = React.useState(data.defaultDateYmd);
  const [recoverTrayId, setRecoverTrayId] = React.useState(
    prevEmptyMatch?.id ?? ""
  );

  // Sell state
  const [buyerId, setBuyerId] = React.useState(buyers[0]?.id ?? "");
  const [saleDate, setSaleDate] = React.useState(data.defaultDateYmd);
  const [saleWeightG, setSaleWeightG] = React.useState(String(crab.latestWeightG));
  const [salePriceKg, setSalePriceKg] = React.useState("1400");
  const [saleTotal, setSaleTotal] = React.useState(() =>
    String(Math.round((crab.latestWeightG / 1000) * 1400 * 100) / 100)
  );
  const [paymentStatus, setPaymentStatus] = React.useState<"PAID" | "PENDING">("PAID");

  // Dead state
  const [deadDate, setDeadDate] = React.useState(data.defaultDateYmd);
  const [deathCause, setDeathCause] = React.useState("");
  const [deadWeightG, setDeadWeightG] = React.useState("");
  const [deadNotes, setDeadNotes] = React.useState("");

  // Edit initial details state
  const [editSupplierId, setEditSupplierId] = React.useState(crab.supplierId);
  const [editSex, setEditSex] = React.useState<"MALE" | "FEMALE">(crab.sex);
  const [editInitWeight, setEditInitWeight] = React.useState(
    String(crab.initialWeightG)
  );
  const [editPurchaseCost, setEditPurchaseCost] = React.useState(
    String(crab.purchaseCost)
  );
  const [editStockedDate, setEditStockedDate] = React.useState(
    crab.stockedDateYmd
  );
  const [editExpHarvest, setEditExpHarvest] = React.useState(
    crab.expectedHarvestDateYmd
  );
  const [editNotes, setEditNotes] = React.useState(crab.notes ?? "");

  const recalcSaleTotal = (wStr: string, pStr: string) => {
    const w = Number(wStr);
    const p = Number(pStr);
    if (Number.isFinite(w) && Number.isFinite(p) && w >= 0 && p >= 0) {
      setSaleTotal(String(Math.round((w / 1000) * p * 100) / 100));
    }
  };

  const openModal = (kind: ModalKind) => {
    if (kind === "weight") setWeightG(String(crab.latestWeightG));
    if (kind === "sell") {
      setSaleWeightG(String(crab.latestWeightG));
      recalcSaleTotal(String(crab.latestWeightG), salePriceKg);
    }
    setModal(kind);
  };

  const runAction = async (
    promise: Promise<{ ok: boolean; error?: string; message?: string }>,
    fallbackMsg: string
  ) => {
    setPending(true);
    const res = await promise;
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Action failed");
      return;
    }
    toast.success(res.message ?? fallbackMsg);
    setModal(null);
    router.refresh();
  };

  const selectedFeedType = feedTypes.find((f) => f.id === feedTypeId);
  const estFeedCost = selectedFeedType
    ? (Number(feedQtyG || 0) / 1000) * selectedFeedType.costPerKg
    : 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(crab.status === "ACTIVE" || crab.status === "SICK") && (
          <>
            {crab.status === "ACTIVE" && (
              <Button size="sm" onClick={() => openModal("feed")}>
                <Utensils className="h-4 w-4" />
                Feed
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => openModal("weight")}>
              <Scale className="h-4 w-4" />
              Weigh
            </Button>
            <Button size="sm" variant="outline" onClick={() => openModal("molt")}>
              <Shell className="h-4 w-4" />
              Molt
            </Button>
            <Button size="sm" variant="outline" onClick={() => openModal("move")}>
              <ArrowRightLeft className="h-4 w-4" />
              Move Tray
            </Button>
          </>
        )}

        {crab.status === "ACTIVE" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-50"
              onClick={() => openModal("sick")}
            >
              <Stethoscope className="h-4 w-4" />
              Mark Sick
            </Button>
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={() => openModal("sell")}
            >
              <IndianRupee className="h-4 w-4" />
              Sell Crab
            </Button>
          </>
        )}

        {crab.status === "SICK" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openModal("treatment")}
            >
              <Stethoscope className="h-4 w-4" />
              Add Treatment
            </Button>
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={() => openModal("recover")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Recovered
            </Button>
          </>
        )}

        {(crab.status === "ACTIVE" || crab.status === "SICK") && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openModal("dead")}
          >
            <Skull className="h-4 w-4" />
            Mark Dead
          </Button>
        )}

        <Button size="sm" variant="ghost" onClick={() => openModal("edit")}>
          <Edit3 className="h-4 w-4" />
          Edit Details
        </Button>
      </div>

      {/* LOG FEED */}
      <Dialog
        open={modal === "feed"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Log Feed — ${crab.code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              addFeedLogAction({
                crabId: crab.id,
                dateTime: feedDateTime,
                feedTypeId,
                quantityG: Number(feedQtyG),
                timeSlot: feedSlot,
                notes: feedNotes,
              }),
              "Feed logged"
            );
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cf-dt">Date &amp; Time</Label>
              <Input
                id="cf-dt"
                type="datetime-local"
                value={feedDateTime}
                onChange={(e) => setFeedDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cf-slot">Time Slot</Label>
              <Select
                id="cf-slot"
                value={feedSlot}
                onChange={(e) =>
                  setFeedSlot(e.target.value as "MORNING" | "EVENING" | "NIGHT")
                }
              >
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
                <option value="NIGHT">Night</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cf-type">Feed Type</Label>
              <Select
                id="cf-type"
                value={feedTypeId}
                onChange={(e) => setFeedTypeId(e.target.value)}
                required
              >
                {feedTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name} ({formatINR(ft.costPerKg)}/kg)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cf-qty">Quantity (g)</Label>
              <Input
                id="cf-qty"
                type="number"
                step="any"
                min="0.1"
                value={feedQtyG}
                onChange={(e) => setFeedQtyG(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Cost at time: {formatINR(estFeedCost)}
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="cf-notes">Notes (optional)</Label>
            <Input
              id="cf-notes"
              value={feedNotes}
              onChange={(e) => setFeedNotes(e.target.value)}
              placeholder="Appetite, uneaten leftovers..."
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !feedTypeId}>
              {pending ? "Saving..." : "Log Feed"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* LOG WEIGHT */}
      <Dialog
        open={modal === "weight"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Log Weight — ${crab.code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              addWeightLogAction({
                crabId: crab.id,
                date: weightDate,
                weightG: Number(weightG),
              }),
              "Weight saved"
            );
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="cw-date">Date</Label>
            <Input
              id="cw-date"
              type="date"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="cw-g">Weight (g)</Label>
            <Input
              id="cw-g"
              type="number"
              step="any"
              min="1"
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Weight"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* LOG MOLT */}
      <Dialog
        open={modal === "molt"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Log Molt — ${crab.code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              addMoltLogAction({
                crabId: crab.id,
                date: moltDate,
                stage: moltStage,
                weightAfterG: moltWeightAfter || null,
                notes: moltNotes,
              }),
              "Molt stage saved"
            );
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cm-date">Date</Label>
              <Input
                id="cm-date"
                type="date"
                value={moltDate}
                onChange={(e) => setMoltDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cm-stage">Stage</Label>
              <Select
                id="cm-stage"
                value={moltStage}
                onChange={(e) =>
                  setMoltStage(
                    e.target.value as
                      | "PRE_MOLT"
                      | "MOLTED"
                      | "SOFT"
                      | "HARDENING"
                      | "HARD"
                  )
                }
              >
                <option value="PRE_MOLT">PRE_MOLT (dull shell / feeding slows)</option>
                <option value="MOLTED">MOLTED (just shed)</option>
                <option value="SOFT">SOFT (needs protection)</option>
                <option value="HARDENING">HARDENING</option>
                <option value="HARD">HARD (post-molt complete)</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cm-w">Weight After Molt (g, optional)</Label>
            <Input
              id="cm-w"
              type="number"
              step="any"
              min="1"
              value={moltWeightAfter}
              onChange={(e) => setMoltWeightAfter(e.target.value)}
              placeholder="Weigh only after shell starts hardening"
            />
          </div>
          <div>
            <Label htmlFor="cm-notes">Notes (optional)</Label>
            <Textarea
              id="cm-notes"
              value={moltNotes}
              onChange={(e) => setMoltNotes(e.target.value)}
              placeholder="Clean molt, intact limbs..."
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Log Molt"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MOVE TRAY */}
      <Dialog
        open={modal === "move"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Move Crab ${crab.code}`}
        description={
          crab.currentTrayNumber
            ? `Currently in Tray ${crab.currentTrayNumber}`
            : undefined
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              moveCrabTrayAction({
                crabId: crab.id,
                newTrayId: moveTrayId,
                reason: moveReason,
                moveDate,
              }),
              "Crab moved to new tray"
            );
          }}
          className="space-y-4"
        >
          {emptyTrays.length === 0 ? (
            <p className="text-sm text-red-700 font-semibold">
              No empty active trays available. Free or add a tray first.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="mv-tray">Destination Empty Tray *</Label>
                <Select
                  id="mv-tray"
                  value={moveTrayId}
                  onChange={(e) => setMoveTrayId(e.target.value)}
                  required
                >
                  {emptyTrays.map((t) => (
                    <option key={t.id} value={t.id}>
                      Tray {t.number} {t.isTreatmentTray ? "(Treatment tray)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="mv-reason">Reason</Label>
                  <Select
                    id="mv-reason"
                    value={moveReason}
                    onChange={(e) =>
                      setMoveReason(
                        e.target.value as
                          | "MOVED_TO_TREATMENT"
                          | "MOVED_BACK"
                          | "MOVED_OTHER"
                      )
                    }
                  >
                    <option value="MOVED_OTHER">General move</option>
                    <option value="MOVED_TO_TREATMENT">Moved to treatment</option>
                    <option value="MOVED_BACK">Moved back from treatment</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mv-date">Date</Label>
                  <Input
                    id="mv-date"
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || emptyTrays.length === 0}>
              {pending ? "Moving..." : "Confirm Move"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MARK SICK */}
      <Dialog
        open={modal === "sick"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Mark Crab ${crab.code} Sick`}
        description="Creates the first treatment log entry and optionally moves to a treatment tray."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              markCrabSickAction({
                crabId: crab.id,
                date: treatDate,
                symptoms,
                diagnosis,
                treatment,
                dose,
                cost: Number(treatCost || 0),
                notes: treatNotes,
                moveToTrayId: sickMoveTrayId || null,
              }),
              "Crab marked SICK"
            );
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sk-date">Date *</Label>
              <Input
                id="sk-date"
                type="date"
                value={treatDate}
                onChange={(e) => setTreatDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sk-cost">Treatment Cost (₹)</Label>
              <Input
                id="sk-cost"
                type="number"
                step="any"
                min="0"
                value={treatCost}
                onChange={(e) => setTreatCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sk-sym">Symptoms *</Label>
            <Input
              id="sk-sym"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Lethargy, shell spots, refusal to feed"
              required
            />
          </div>
          <div>
            <Label htmlFor="sk-diag">Diagnosis (optional)</Label>
            <Input
              id="sk-diag"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Suspected shell necrosis / fungal..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sk-treat">Treatment / Medicine *</Label>
              <Input
                id="sk-treat"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                placeholder="e.g. Freshwater bath + iodine"
                required
              />
            </div>
            <div>
              <Label htmlFor="sk-dose">Dose (optional)</Label>
              <Input
                id="sk-dose"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="e.g. 15 min dip"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sk-tray">Move to Treatment Tray (optional)</Label>
            <Select
              id="sk-tray"
              value={sickMoveTrayId}
              onChange={(e) => setSickMoveTrayId(e.target.value)}
            >
              <option value="">
                Keep in current Tray {crab.currentTrayNumber ?? ""}
              </option>
              {emptyTrays.map((t) => (
                <option key={t.id} value={t.id}>
                  Move to Tray {t.number}
                  {t.isTreatmentTray ? " ★ Treatment tray" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sk-notes">Notes (optional)</Label>
            <Textarea
              id="sk-notes"
              value={treatNotes}
              onChange={(e) => setTreatNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Mark Sick & Start Treatment"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ADD TREATMENT */}
      <Dialog
        open={modal === "treatment"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Add Treatment — ${crab.code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              addTreatmentAction({
                crabId: crab.id,
                date: treatDate,
                symptoms,
                diagnosis,
                treatment,
                dose,
                cost: Number(treatCost || 0),
                outcome: treatOutcome,
                notes: treatNotes,
              }),
              "Treatment logged"
            );
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="tr-date">Date *</Label>
              <Input
                id="tr-date"
                type="date"
                value={treatDate}
                onChange={(e) => setTreatDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="tr-cost">Cost (₹)</Label>
              <Input
                id="tr-cost"
                type="number"
                step="any"
                min="0"
                value={treatCost}
                onChange={(e) => setTreatCost(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tr-out">Outcome</Label>
              <Select
                id="tr-out"
                value={treatOutcome}
                onChange={(e) =>
                  setTreatOutcome(
                    e.target.value as "ONGOING" | "RECOVERED" | "DIED"
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
            <Label htmlFor="tr-sym">Symptoms *</Label>
            <Input
              id="tr-sym"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="tr-treat">Treatment / Medicine *</Label>
            <Input
              id="tr-treat"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tr-diag">Diagnosis</Label>
              <Input
                id="tr-diag"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tr-dose">Dose</Label>
              <Input
                id="tr-dose"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tr-notes">Notes</Label>
            <Textarea
              id="tr-notes"
              value={treatNotes}
              onChange={(e) => setTreatNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Log Treatment"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MARK RECOVERED */}
      <Dialog
        open={modal === "recover"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Mark Crab ${crab.code} Recovered`}
        description="Returns status to ACTIVE and closes ongoing treatments as RECOVERED."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              markCrabRecoveredAction({
                crabId: crab.id,
                date: recoverDate,
                moveToTrayId: recoverTrayId || null,
              }),
              "Crab recovered"
            );
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="rec-date">Recovery Date</Label>
            <Input
              id="rec-date"
              type="date"
              value={recoverDate}
              onChange={(e) => setRecoverDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="rec-tray">Move to Tray (optional)</Label>
            <Select
              id="rec-tray"
              value={recoverTrayId}
              onChange={(e) => setRecoverTrayId(e.target.value)}
            >
              <option value="">
                Keep in current Tray {crab.currentTrayNumber ?? ""}
              </option>
              {emptyTrays.map((t) => (
                <option key={t.id} value={t.id}>
                  Move to Tray {t.number}
                  {t.id === crab.previousNonTreatmentTrayId
                    ? " (Previous tray)"
                    : t.isTreatmentTray
                    ? " (Treatment tray)"
                    : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Mark Recovered (ACTIVE)"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* SELL CRAB */}
      <Dialog
        open={modal === "sell"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Sell Crab ${crab.code}`}
        description="Sets status to SOLD, closes tray assignment, and frees the tray."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              sellCrabAction({
                crabId: crab.id,
                buyerId,
                date: saleDate,
                weightG: Number(saleWeightG),
                pricePerKg: Number(salePriceKg),
                totalAmount: Number(saleTotal),
                paymentStatus,
              }),
              `Crab ${crab.code} sold!`
            );
          }}
          className="space-y-4"
        >
          {buyers.length === 0 ? (
            <p className="text-sm text-red-700 font-semibold">
              Add a buyer under Suppliers &amp; Buyers before selling.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sl-buyer">Buyer *</Label>
                  <Select
                    id="sl-buyer"
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                    required
                  >
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sl-date">Sale Date *</Label>
                  <Input
                    id="sl-date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="sl-weight">Final Weight (g) *</Label>
                  <Input
                    id="sl-weight"
                    type="number"
                    step="any"
                    min="1"
                    value={saleWeightG}
                    onChange={(e) => {
                      setSaleWeightG(e.target.value);
                      recalcSaleTotal(e.target.value, salePriceKg);
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sl-rate">Price per kg (₹) *</Label>
                  <Input
                    id="sl-rate"
                    type="number"
                    step="any"
                    min="1"
                    value={salePriceKg}
                    onChange={(e) => {
                      setSalePriceKg(e.target.value);
                      recalcSaleTotal(saleWeightG, e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sl-total">Total Amount (₹) *</Label>
                  <Input
                    id="sl-total"
                    type="number"
                    step="any"
                    min="0"
                    value={saleTotal}
                    onChange={(e) => setSaleTotal(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="sl-paid">Payment Status</Label>
                <Select
                  id="sl-paid"
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as "PAID" | "PENDING")
                  }
                >
                  <option value="PAID">PAID</option>
                  <option value="PENDING">PENDING (shows on pending payments)</option>
                </Select>
              </div>
            </>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || buyers.length === 0}>
              {pending ? "Recording..." : "Confirm Sale"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MARK DEAD */}
      <Dialog
        open={modal === "dead"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Mark Crab ${crab.code} Dead`}
        description="Closes crab and tray assignment permanently; frees tray while preserving all logs."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              markCrabDeadAction({
                crabId: crab.id,
                endDate: deadDate,
                deathCause,
                finalWeightG: deadWeightG || null,
                notes: deadNotes,
              }),
              `Crab ${crab.code} marked DEAD`
            );
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dd-date">End Date *</Label>
              <Input
                id="dd-date"
                type="date"
                value={deadDate}
                onChange={(e) => setDeadDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dd-wt">Final Weight (g, optional)</Label>
              <Input
                id="dd-wt"
                type="number"
                step="any"
                min="1"
                value={deadWeightG}
                onChange={(e) => setDeadWeightG(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dd-cause">Cause (optional)</Label>
            <Input
              id="dd-cause"
              value={deathCause}
              onChange={(e) => setDeathCause(e.target.value)}
              placeholder="Molt stress, ammonia spike, injury..."
            />
          </div>
          <div>
            <Label htmlFor="dd-notes">Notes (optional)</Label>
            <Textarea
              id="dd-notes"
              value={deadNotes}
              onChange={(e) => setDeadNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Saving..." : "Confirm Dead"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT INITIAL DETAILS (CODE LOCKED) */}
      <Dialog
        open={modal === "edit"}
        onOpenChange={(o) => !o && setModal(null)}
        title={`Edit Crab ${crab.code}`}
        description="Crab code is permanent and cannot be changed."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              updateCrabInitialDetailsAction({
                crabId: crab.id,
                supplierId: editSupplierId,
                sex: editSex,
                initialWeightG: Number(editInitWeight),
                purchaseCost: Number(editPurchaseCost),
                stockedDate: editStockedDate,
                expectedHarvestDate: editExpHarvest || null,
                notes: editNotes,
              }),
              "Crab details updated"
            );
          }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">
              Crab Code (locked)
            </span>
            <Badge variant="teal" className="font-mono text-sm">
              {crab.code}
            </Badge>
          </div>

          <div>
            <Label htmlFor="ed-sup">Batch {crab.batchLetter} Supplier *</Label>
            <Select
              id="ed-sup"
              value={editSupplierId}
              onChange={(e) => setEditSupplierId(e.target.value)}
              required
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {crab.batchCrabCount > 1 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Batch {crab.batchLetter} has {crab.batchCrabCount} crabs; changing supplier updates the whole batch.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ed-sex">Sex</Label>
              <Select
                id="ed-sex"
                value={editSex}
                onChange={(e) => setEditSex(e.target.value as "MALE" | "FEMALE")}
              >
                <option value="MALE">MALE</option>
                <option value="FEMALE">FEMALE</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ed-wt">Initial Weight (g) *</Label>
              <Input
                id="ed-wt"
                type="number"
                step="any"
                min="1"
                value={editInitWeight}
                onChange={(e) => setEditInitWeight(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ed-cost">Purchase Cost (₹) *</Label>
              <Input
                id="ed-cost"
                type="number"
                step="any"
                min="0"
                value={editPurchaseCost}
                onChange={(e) => setEditPurchaseCost(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ed-stocked">Stocked Date *</Label>
              <Input
                id="ed-stocked"
                type="date"
                value={editStockedDate}
                onChange={(e) => setEditStockedDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ed-harvest">Expected Harvest (optional)</Label>
              <Input
                id="ed-harvest"
                type="date"
                value={editExpHarvest}
                onChange={(e) => setEditExpHarvest(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ed-notes">Notes (optional)</Label>
            <Textarea
              id="ed-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

