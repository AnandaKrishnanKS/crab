"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Droplets, Edit3, Plus, Scale, Shell, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import {
  addMoltLogAction,
  addWeightLogAction,
  batchFeedCrabsAction,
  deleteFeedLogAction,
  deleteMoltLogAction,
  deleteWeightLogAction,
  updateFeedLogAction,
  updateMoltLogAction,
  updateWeightLogAction,
} from "@/app/actions/logs";
import {
  addWaterTestAction,
  deleteWaterTestAction,
  updateWaterTestAction,
} from "@/app/actions/water";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface DailyFeedTypeOption {
  id: string;
  name: string;
  costPerKg: number;
}

export interface DailyActiveCrab {
  id: string;
  code: string;
  trayNumber: string | null;
  todayFeedG: number;
}

export interface DailyOpenCrab {
  id: string;
  code: string;
  status: "ACTIVE" | "SICK";
  trayNumber: string | null;
  latestWeightG: number;
}

export interface DailyWaterTestRow {
  id: string;
  dateTime: string;
  salinityPpt: number | null;
  pH: number | null;
  ammoniaMgL: number | null;
  nitriteMgL: number | null;
  nitrateMgL: number | null;
  alkalinityMgL: number | null;
  temperatureC: number | null;
  dissolvedOxygenMgL: number | null;
  notes: string | null;
}

export interface DailyTodayLogs {
  feedLogs: Array<{
    id: string;
    crabId: string;
    crabCode: string;
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
    crabId: string;
    crabCode: string;
    date: string;
    weightG: number;
  }>;
  moltLogs: Array<{
    id: string;
    crabId: string;
    crabCode: string;
    date: string;
    stage: "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD";
    weightAfterG: number | null;
    notes: string | null;
  }>;
  waterTests: DailyWaterTestRow[];
}

export function DailyLogClient({
  defaultDateYmd,
  defaultDateTimeLocal,
  defaultSlot,
  latestWaterTest,
  activeCrabs,
  sickCrabsCount,
  openCrabs,
  feedTypes,
  editFeedTypes,
  todayLogs,
}: {
  defaultDateYmd: string;
  defaultDateTimeLocal: string;
  defaultSlot: "MORNING" | "EVENING" | "NIGHT";
  latestWaterTest: DailyWaterTestRow | null;
  activeCrabs: DailyActiveCrab[];
  sickCrabsCount: number;
  openCrabs: DailyOpenCrab[];
  feedTypes: DailyFeedTypeOption[];
  editFeedTypes: DailyFeedTypeOption[];
  todayLogs: DailyTodayLogs;
}) {
  const router = useRouter();

  // ---- Section 1: Water Test Form ----
  const [wtDateTime, setWtDateTime] = React.useState(defaultDateTimeLocal);
  const [wtSalinity, setWtSalinity] = React.useState("");
  const [wtPh, setWtPh] = React.useState("");
  const [wtAmmonia, setWtAmmonia] = React.useState("");
  const [wtNitrite, setWtNitrite] = React.useState("");
  const [wtNitrate, setWtNitrate] = React.useState("");
  const [wtAlk, setWtAlk] = React.useState("");
  const [wtTemp, setWtTemp] = React.useState("");
  const [wtDo, setWtDo] = React.useState("");
  const [wtNotes, setWtNotes] = React.useState("");
  const [wtPending, setWtPending] = React.useState(false);

  const handleAddWaterTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWtPending(true);
    const res = await addWaterTestAction({
      dateTime: wtDateTime,
      salinityPpt: wtSalinity,
      pH: wtPh,
      ammoniaMgL: wtAmmonia,
      nitriteMgL: wtNitrite,
      nitrateMgL: wtNitrate,
      alkalinityMgL: wtAlk,
      temperatureC: wtTemp,
      dissolvedOxygenMgL: wtDo,
      notes: wtNotes,
    });
    setWtPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Water test logged for RAS");
    setWtSalinity("");
    setWtPh("");
    setWtAmmonia("");
    setWtNitrite("");
    setWtNitrate("");
    setWtAlk("");
    setWtTemp("");
    setWtDo("");
    setWtNotes("");
    router.refresh();
  };

  // ---- Section 2: Batch Feed ----
  const defaultFeedTypeId = feedTypes[0]?.id ?? "";
  const [feedDateTime, setFeedDateTime] = React.useState(defaultDateTimeLocal);
  const [feedSlot, setFeedSlot] = React.useState<"MORNING" | "EVENING" | "NIGHT">(defaultSlot);
  const [bulkFeedTypeId, setBulkFeedTypeId] = React.useState(defaultFeedTypeId);
  const [bulkQtyG, setBulkQtyG] = React.useState("25");
  const [unfedOnly, setUnfedOnly] = React.useState(false);
  const [feedRows, setFeedRows] = React.useState<
    Record<string, { feedTypeId: string; quantityG: string }>
  >({});
  const [feedPending, setFeedPending] = React.useState(false);

  const shownFeedCrabs = unfedOnly
    ? activeCrabs.filter((c) => c.todayFeedG <= 0)
    : activeCrabs;

  const unfedCount = activeCrabs.filter((c) => c.todayFeedG <= 0).length;

  const handleApplyToShown = () => {
    if (!bulkFeedTypeId) {
      toast.error("Select a feed type first.");
      return;
    }
    const qty = Number(bulkQtyG);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a bulk quantity > 0 g.");
      return;
    }
    setFeedRows((prev) => {
      const next = { ...prev };
      for (const c of shownFeedCrabs) {
        next[c.id] = {
          feedTypeId: bulkFeedTypeId,
          quantityG: String(bulkQtyG),
        };
      }
      return next;
    });
  };

  const handleClearFeedRows = () => {
    setFeedRows((prev) => {
      const next: Record<string, { feedTypeId: string; quantityG: string }> = {};
      for (const [id, v] of Object.entries(prev)) {
        next[id] = { feedTypeId: v.feedTypeId, quantityG: "" };
      }
      return next;
    });
  };

  const selectedFeedItems = activeCrabs
    .map((c) => {
      const row = feedRows[c.id];
      const qty = Number(row?.quantityG || 0);
      return {
        crabId: c.id,
        feedTypeId: row?.feedTypeId || defaultFeedTypeId,
        quantityG: qty,
      };
    })
    .filter((i) => Number.isFinite(i.quantityG) && i.quantityG > 0 && i.feedTypeId);

  const selectedTotalG = selectedFeedItems.reduce((acc, i) => acc + i.quantityG, 0);

  const handleSubmitBatchFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFeedItems.length === 0) {
      toast.error("Enter quantity (g) for at least one crab.");
      return;
    }
    setFeedPending(true);
    const res = await batchFeedCrabsAction({
      dateTime: feedDateTime,
      timeSlot: feedSlot,
      items: selectedFeedItems,
    });
    setFeedPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? `Logged feed for ${selectedFeedItems.length} crab(s).`);
    handleClearFeedRows();
    router.refresh();
  };

  // ---- Section 3: Quick Weight & Quick Molt ----
  const [weightCrabId, setWeightCrabId] = React.useState(openCrabs[0]?.id ?? "");
  const [weightDate, setWeightDate] = React.useState(defaultDateYmd);
  const [weightG, setWeightG] = React.useState("");
  const [weightPending, setWeightPending] = React.useState(false);

  const [moltCrabId, setMoltCrabId] = React.useState(openCrabs[0]?.id ?? "");
  const [moltDate, setMoltDate] = React.useState(defaultDateYmd);
  const [moltStage, setMoltStage] = React.useState<
    "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD"
  >("MOLTED");
  const [moltWeightAfterG, setMoltWeightAfterG] = React.useState("");
  const [moltNotes, setMoltNotes] = React.useState("");
  const [moltPending, setMoltPending] = React.useState(false);

  const handleQuickWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightCrabId) return;
    setWeightPending(true);
    const res = await addWeightLogAction({
      crabId: weightCrabId,
      date: weightDate,
      weightG: Number(weightG),
    });
    setWeightPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Weight logged");
    setWeightG("");
    router.refresh();
  };

  const handleQuickMolt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moltCrabId) return;
    setMoltPending(true);
    const res = await addMoltLogAction({
      crabId: moltCrabId,
      date: moltDate,
      stage: moltStage,
      weightAfterG: moltWeightAfterG ? Number(moltWeightAfterG) : null,
      notes: moltNotes,
    });
    setMoltPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Molt stage logged");
    setMoltWeightAfterG("");
    setMoltNotes("");
    router.refresh();
  };

  // ---- Section 4: Today's Logs Edit / Delete ----
  const [logsTab, setLogsTab] = React.useState<"feed" | "weights" | "molts" | "water">("feed");

  const [editFeed, setEditFeed] = React.useState<DailyTodayLogs["feedLogs"][number] | null>(null);
  const [efDateTime, setEfDateTime] = React.useState("");
  const [efFeedTypeId, setEfFeedTypeId] = React.useState("");
  const [efQtyG, setEfQtyG] = React.useState("");
  const [efSlot, setEfSlot] = React.useState<"MORNING" | "EVENING" | "NIGHT">("MORNING");
  const [efCostAtTime, setEfCostAtTime] = React.useState("");
  const [efNotes, setEfNotes] = React.useState("");

  const [editWeight, setEditWeight] = React.useState<DailyTodayLogs["weightLogs"][number] | null>(null);
  const [ewDate, setEwDate] = React.useState("");
  const [ewWeightG, setEwWeightG] = React.useState("");

  const [editMolt, setEditMolt] = React.useState<DailyTodayLogs["moltLogs"][number] | null>(null);
  const [emDate, setEmDate] = React.useState("");
  const [emStage, setEmStage] = React.useState<
    "PRE_MOLT" | "MOLTED" | "SOFT" | "HARDENING" | "HARD"
  >("MOLTED");
  const [emWeightAfterG, setEmWeightAfterG] = React.useState("");
  const [emNotes, setEmNotes] = React.useState("");

  const [editWater, setEditWater] = React.useState<DailyWaterTestRow | null>(null);
  const [ewtDateTime, setEwtDateTime] = React.useState("");
  const [ewtSal, setEwtSal] = React.useState("");
  const [ewtPh, setEwtPh] = React.useState("");
  const [ewtNh3, setEwtNh3] = React.useState("");
  const [ewtNo2, setEwtNo2] = React.useState("");
  const [ewtNo3, setEwtNo3] = React.useState("");
  const [ewtAlk, setEwtAlk] = React.useState("");
  const [ewtTemp, setEwtTemp] = React.useState("");
  const [ewtDo, setEwtDo] = React.useState("");
  const [ewtNotes, setEwtNotes] = React.useState("");

  const [editPending, setEditPending] = React.useState(false);

  const [deleting, setDeleting] = React.useState<{
    kind: "feed" | "weight" | "molt" | "water";
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const openEditFeed = (row: DailyTodayLogs["feedLogs"][number]) => {
    setEditFeed(row);
    setEfDateTime(toISTDateTimeInput(new Date(row.dateTime)));
    setEfFeedTypeId(row.feedTypeId);
    setEfQtyG(String(row.quantityG));
    setEfSlot(row.timeSlot);
    setEfCostAtTime(String(row.costAtTime));
    setEfNotes(row.notes ?? "");
  };

  const recalcFeedEditCost = (nextFeedTypeId: string, nextQtyStr: string) => {
    const ft = editFeedTypes.find((x) => x.id === nextFeedTypeId);
    const qty = Number(nextQtyStr);
    if (ft && Number.isFinite(qty) && qty > 0) {
      setEfCostAtTime(String(Math.round((qty / 1000) * ft.costPerKg * 100) / 100));
    }
  };

  const openEditWeight = (row: DailyTodayLogs["weightLogs"][number]) => {
    setEditWeight(row);
    setEwDate(toISTDateString(new Date(row.date)));
    setEwWeightG(String(row.weightG));
  };

  const openEditMolt = (row: DailyTodayLogs["moltLogs"][number]) => {
    setEditMolt(row);
    setEmDate(toISTDateString(new Date(row.date)));
    setEmStage(row.stage);
    setEmWeightAfterG(row.weightAfterG !== null ? String(row.weightAfterG) : "");
    setEmNotes(row.notes ?? "");
  };

  const openEditWater = (row: DailyWaterTestRow) => {
    setEditWater(row);
    setEwtDateTime(toISTDateTimeInput(new Date(row.dateTime)));
    setEwtSal(row.salinityPpt !== null ? String(row.salinityPpt) : "");
    setEwtPh(row.pH !== null ? String(row.pH) : "");
    setEwtNh3(row.ammoniaMgL !== null ? String(row.ammoniaMgL) : "");
    setEwtNo2(row.nitriteMgL !== null ? String(row.nitriteMgL) : "");
    setEwtNo3(row.nitrateMgL !== null ? String(row.nitrateMgL) : "");
    setEwtAlk(row.alkalinityMgL !== null ? String(row.alkalinityMgL) : "");
    setEwtTemp(row.temperatureC !== null ? String(row.temperatureC) : "");
    setEwtDo(row.dissolvedOxygenMgL !== null ? String(row.dissolvedOxygenMgL) : "");
    setEwtNotes(row.notes ?? "");
  };

  const handleSaveEditFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFeed) return;
    setEditPending(true);
    const res = await updateFeedLogAction({
      id: editFeed.id,
      dateTime: efDateTime,
      feedTypeId: efFeedTypeId,
      quantityG: Number(efQtyG),
      timeSlot: efSlot,
      costAtTime: Number(efCostAtTime || 0),
      notes: efNotes,
    });
    setEditPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Feed log updated");
    setEditFeed(null);
    router.refresh();
  };

  const handleSaveEditWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWeight) return;
    setEditPending(true);
    const res = await updateWeightLogAction({
      id: editWeight.id,
      date: ewDate,
      weightG: Number(ewWeightG),
    });
    setEditPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Weight log updated");
    setEditWeight(null);
    router.refresh();
  };

  const handleSaveEditMolt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMolt) return;
    setEditPending(true);
    const res = await updateMoltLogAction({
      id: editMolt.id,
      date: emDate,
      stage: emStage,
      weightAfterG: emWeightAfterG ? Number(emWeightAfterG) : null,
      notes: emNotes,
    });
    setEditPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Molt log updated");
    setEditMolt(null);
    router.refresh();
  };

  const handleSaveEditWater = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWater) return;
    setEditPending(true);
    const res = await updateWaterTestAction({
      id: editWater.id,
      dateTime: ewtDateTime,
      salinityPpt: ewtSal,
      pH: ewtPh,
      ammoniaMgL: ewtNh3,
      nitriteMgL: ewtNo2,
      nitrateMgL: ewtNo3,
      alkalinityMgL: ewtAlk,
      temperatureC: ewtTemp,
      dissolvedOxygenMgL: ewtDo,
      notes: ewtNotes,
    });
    setEditPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Water test updated");
    setEditWater(null);
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    const res =
      deleting.kind === "feed"
        ? await deleteFeedLogAction(deleting.id)
        : deleting.kind === "weight"
        ? await deleteWeightLogAction(deleting.id)
        : deleting.kind === "molt"
        ? await deleteMoltLogAction(deleting.id)
        : await deleteWaterTestAction(deleting.id);
    setDeletePending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Deleted");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Log</h1>
          <p className="text-sm text-slate-600">
            Fast routine entry for shared RAS water tests, batch crab feeding, weights, and molts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="#water-test"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Droplets className="h-3.5 w-3.5 text-teal-700" />
            Water Test
          </a>
          <a
            href="#feed"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Utensils className="h-3.5 w-3.5 text-teal-700" />
            Batch Feed ({activeCrabs.length})
          </a>
          <a
            href="#weight-molt"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Scale className="h-3.5 w-3.5 text-teal-700" />
            Weight &amp; Molt
          </a>
        </div>
      </div>

      {/* SECTION 1: Whole-RAS Water Test */}
      <Card id="water-test" className="scroll-mt-20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-teal-700" />
                RAS Water Test (Whole System)
              </CardTitle>
              <CardDescription>
                One shared reading applies to every tray. Fill only the parameters measured.
              </CardDescription>
            </div>
            <Link
              href="/water"
              className="text-xs font-semibold text-teal-800 hover:underline w-fit"
            >
              View Water History &amp; Charts
            </Link>
          </div>
          {latestWaterTest && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-900">
                Last test ({formatDateTimeIN(new Date(latestWaterTest.dateTime))}):
              </span>
              {latestWaterTest.salinityPpt !== null && (
                <span>Sal {formatNumberIN(latestWaterTest.salinityPpt, 1)} ppt</span>
              )}
              {latestWaterTest.pH !== null && (
                <span>pH {formatNumberIN(latestWaterTest.pH, 2)}</span>
              )}
              {latestWaterTest.ammoniaMgL !== null && (
                <span>NH₃ {formatNumberIN(latestWaterTest.ammoniaMgL, 2)} mg/L</span>
              )}
              {latestWaterTest.nitriteMgL !== null && (
                <span>NO₂ {formatNumberIN(latestWaterTest.nitriteMgL, 2)} mg/L</span>
              )}
              {latestWaterTest.nitrateMgL !== null && (
                <span>NO₃ {formatNumberIN(latestWaterTest.nitrateMgL, 1)} mg/L</span>
              )}
              {latestWaterTest.temperatureC !== null && (
                <span>{formatNumberIN(latestWaterTest.temperatureC, 1)} °C</span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddWaterTest} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="sm:col-span-2 lg:col-span-2">
                <Label htmlFor="dl-wt-dt">Date &amp; Time *</Label>
                <Input
                  id="dl-wt-dt"
                  type="datetime-local"
                  value={wtDateTime}
                  onChange={(e) => setWtDateTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-sal">Salinity (ppt)</Label>
                <Input
                  id="dl-wt-sal"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 20"
                  value={wtSalinity}
                  onChange={(e) => setWtSalinity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-ph">pH</Label>
                <Input
                  id="dl-wt-ph"
                  type="number"
                  step="any"
                  min="0"
                  max="14"
                  placeholder="e.g. 7.9"
                  value={wtPh}
                  onChange={(e) => setWtPh(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-nh3">Ammonia (mg/L)</Label>
                <Input
                  id="dl-wt-nh3"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 0.05"
                  value={wtAmmonia}
                  onChange={(e) => setWtAmmonia(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-no2">Nitrite (mg/L)</Label>
                <Input
                  id="dl-wt-no2"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 0.1"
                  value={wtNitrite}
                  onChange={(e) => setWtNitrite(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-no3">Nitrate (mg/L)</Label>
                <Input
                  id="dl-wt-no3"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 25"
                  value={wtNitrate}
                  onChange={(e) => setWtNitrate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-alk">Alkalinity (mg/L CaCO₃)</Label>
                <Input
                  id="dl-wt-alk"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 135"
                  value={wtAlk}
                  onChange={(e) => setWtAlk(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-temp">Temp (°C)</Label>
                <Input
                  id="dl-wt-temp"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 28.5"
                  value={wtTemp}
                  onChange={(e) => setWtTemp(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dl-wt-do">DO (mg/L)</Label>
                <Input
                  id="dl-wt-do"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 6.2"
                  value={wtDo}
                  onChange={(e) => setWtDo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label htmlFor="dl-wt-notes">Notes (optional)</Label>
                <Input
                  id="dl-wt-notes"
                  value={wtNotes}
                  onChange={(e) => setWtNotes(e.target.value)}
                  placeholder="Water clarity, odor, aeration observations..."
                />
              </div>
              <Button type="submit" disabled={wtPending} className="sm:w-auto">
                <Plus className="h-4 w-4" />
                {wtPending ? "Saving..." : "Log Water Test"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* SECTION 2: Batch Feed Active Crabs */}
      <Card id="feed" className="scroll-mt-20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-teal-700" />
                Batch Feed Active Crabs ({activeCrabs.length})
              </CardTitle>
              <CardDescription>
                Cost is locked at each feed type&apos;s current ₹/kg when logged.{" "}
                {sickCrabsCount > 0 && (
                  <span className="font-semibold text-red-700">
                    {sickCrabsCount} SICK crab(s) excluded from routine feeding.
                  </span>
                )}
              </CardDescription>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer min-h-9">
              <input
                type="checkbox"
                checked={unfedOnly}
                onChange={(e) => setUnfedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              Unfed today only ({unfedCount})
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {feedTypes.length === 0 ? (
            <p className="text-sm text-amber-800">
              No active feed types found. Enable or create a feed type in{" "}
              <Link href="/feed-types" className="underline font-semibold">
                Feed Types
              </Link>{" "}
              first.
            </p>
          ) : activeCrabs.length === 0 ? (
            <p className="text-sm text-slate-600">
              No ACTIVE crabs right now. Stock a batch on the Crabs page to log feeding.
            </p>
          ) : (
            <form onSubmit={handleSubmitBatchFeed} className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="bf-dt">Feed Date &amp; Time *</Label>
                    <Input
                      id="bf-dt"
                      type="datetime-local"
                      value={feedDateTime}
                      onChange={(e) => setFeedDateTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="bf-slot">Time Slot *</Label>
                    <Select
                      id="bf-slot"
                      value={feedSlot}
                      onChange={(e) =>
                        setFeedSlot(e.target.value as "MORNING" | "EVENING" | "NIGHT")
                      }
                    >
                      <option value="MORNING">MORNING</option>
                      <option value="EVENING">EVENING</option>
                      <option value="NIGHT">NIGHT</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bf-bulk-type">Bulk Feed Type</Label>
                    <Select
                      id="bf-bulk-type"
                      value={bulkFeedTypeId}
                      onChange={(e) => setBulkFeedTypeId(e.target.value)}
                    >
                      {feedTypes.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {ft.name} ({formatINR(ft.costPerKg)}/kg)
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bf-bulk-qty">Bulk Quantity (g)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="bf-bulk-qty"
                        type="number"
                        step="any"
                        min="0.1"
                        value={bulkQtyG}
                        onChange={(e) => setBulkQtyG(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApplyToShown}
                        className="shrink-0"
                      >
                        Apply to shown ({shownFeedCrabs.length})
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {shownFeedCrabs.length === 0 ? (
                <p className="text-sm text-emerald-700 font-medium py-3 text-center">
                  All active crabs have already been fed today!
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {shownFeedCrabs.map((c) => {
                    const row = feedRows[c.id] ?? {
                      feedTypeId: defaultFeedTypeId,
                      quantityG: "",
                    };
                    return (
                      <div
                        key={c.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <Link
                            href={`/crabs/${c.id}`}
                            className="font-mono text-base font-extrabold text-teal-900 hover:underline"
                          >
                            {c.code}
                          </Link>
                          {c.trayNumber && (
                            <span className="text-xs font-semibold text-slate-600">
                              Tray {c.trayNumber}
                            </span>
                          )}
                          {c.todayFeedG > 0 ? (
                            <Badge variant="success">
                              Fed {formatNumberIN(c.todayFeedG, 0)} g today
                            </Badge>
                          ) : (
                            <Badge variant="warning">Not fed today</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:w-[340px]">
                          <Select
                            aria-label={`Feed type for ${c.code}`}
                            value={row.feedTypeId}
                            onChange={(e) =>
                              setFeedRows((prev) => ({
                                ...prev,
                                [c.id]: {
                                  feedTypeId: e.target.value,
                                  quantityG: prev[c.id]?.quantityG ?? "",
                                },
                              }))
                            }
                            className="flex-1"
                          >
                            {feedTypes.map((ft) => (
                              <option key={ft.id} value={ft.id}>
                                {ft.name}
                              </option>
                            ))}
                          </Select>
                          <div className="relative w-28 shrink-0">
                            <Input
                              aria-label={`Quantity in grams for ${c.code}`}
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0 g"
                              value={row.quantityG}
                              onChange={(e) =>
                                setFeedRows((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    feedTypeId: prev[c.id]?.feedTypeId ?? defaultFeedTypeId,
                                    quantityG: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearFeedRows}
                  disabled={selectedFeedItems.length === 0}
                >
                  Clear quantities
                </Button>
                <Button
                  type="submit"
                  disabled={feedPending || selectedFeedItems.length === 0}
                >
                  <Utensils className="h-4 w-4" />
                  {feedPending
                    ? "Logging feed..."
                    : `Log Feed (${selectedFeedItems.length} crab${
                        selectedFeedItems.length === 1 ? "" : "s"
                      } • ${formatNumberIN(selectedTotalG, 0)} g)`}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3: Quick Weight & Molt */}
      <div id="weight-molt" className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-20">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-teal-700" />
              Quick Weight Log
            </CardTitle>
            <CardDescription>Record a sampled weight (g) for an open crab.</CardDescription>
          </CardHeader>
          <CardContent>
            {openCrabs.length === 0 ? (
              <p className="text-sm text-slate-600">No open crabs available.</p>
            ) : (
              <form onSubmit={handleQuickWeight} className="space-y-3">
                <div>
                  <Label htmlFor="qw-crab">Crab *</Label>
                  <Select
                    id="qw-crab"
                    value={weightCrabId}
                    onChange={(e) => setWeightCrabId(e.target.value)}
                    required
                  >
                    {openCrabs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                        {c.trayNumber ? ` (Tray ${c.trayNumber})` : ""} — {c.status},{" "}
                        {formatNumberIN(c.latestWeightG, 0)} g
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qw-date">Date *</Label>
                    <Input
                      id="qw-date"
                      type="date"
                      value={weightDate}
                      onChange={(e) => setWeightDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="qw-g">Weight (g) *</Label>
                    <Input
                      id="qw-g"
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 460"
                      value={weightG}
                      onChange={(e) => setWeightG(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={weightPending} className="w-full sm:w-auto">
                  <Scale className="h-4 w-4" />
                  {weightPending ? "Saving..." : "Log Weight"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shell className="h-4 w-4 text-teal-700" />
              Quick Molt Log
            </CardTitle>
            <CardDescription>
              MOLTED and SOFT stages raise dashboard alerts until hardened.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openCrabs.length === 0 ? (
              <p className="text-sm text-slate-600">No open crabs available.</p>
            ) : (
              <form onSubmit={handleQuickMolt} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qm-crab">Crab *</Label>
                    <Select
                      id="qm-crab"
                      value={moltCrabId}
                      onChange={(e) => setMoltCrabId(e.target.value)}
                      required
                    >
                      {openCrabs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                          {c.trayNumber ? ` (Tray ${c.trayNumber})` : ""} — {c.status}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qm-date">Date *</Label>
                    <Input
                      id="qm-date"
                      type="date"
                      value={moltDate}
                      onChange={(e) => setMoltDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qm-stage">Stage *</Label>
                    <Select
                      id="qm-stage"
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
                      <option value="PRE_MOLT">PRE_MOLT</option>
                      <option value="MOLTED">MOLTED</option>
                      <option value="SOFT">SOFT</option>
                      <option value="HARDENING">HARDENING</option>
                      <option value="HARD">HARD</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qm-wt">Weight After (g, optional)</Label>
                    <Input
                      id="qm-wt"
                      type="number"
                      step="any"
                      min="1"
                      placeholder="optional"
                      value={moltWeightAfterG}
                      onChange={(e) => setMoltWeightAfterG(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="qm-notes">Notes (optional)</Label>
                    <Input
                      id="qm-notes"
                      value={moltNotes}
                      onChange={(e) => setMoltNotes(e.target.value)}
                      placeholder="Shell condition, hardening notes..."
                    />
                  </div>
                  <Button type="submit" disabled={moltPending} className="sm:w-auto">
                    <Shell className="h-4 w-4" />
                    {moltPending ? "Saving..." : "Log Molt"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: Today's Logs with 1-tap Edit & Delete */}
      <Card id="today-logs" className="scroll-mt-20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Today&apos;s Logs ({formatDateIN(new Date(`${defaultDateYmd}T12:00:00+05:30`))})
          </CardTitle>
          <CardDescription>
            Review, edit, or delete mistakes logged today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs
            value={logsTab}
            onChange={(v) => setLogsTab(v)}
            options={[
              { id: "feed" as const, label: "Feed", count: todayLogs.feedLogs.length },
              { id: "weights" as const, label: "Weights", count: todayLogs.weightLogs.length },
              { id: "molts" as const, label: "Molts", count: todayLogs.moltLogs.length },
              { id: "water" as const, label: "Water Tests", count: todayLogs.waterTests.length },
            ]}
          />

          {logsTab === "feed" &&
            (todayLogs.feedLogs.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No feed entries logged today.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {todayLogs.feedLogs.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                          href={`/crabs/${f.crabId}`}
                          className="font-mono font-bold text-teal-800 hover:underline"
                        >
                          {f.crabCode}
                        </Link>
                        <span className="font-semibold text-slate-900">{f.feedName}</span>
                        <span>{formatNumberIN(f.quantityG, 0)} g</span>
                        <Badge variant="default">{f.timeSlot}</Badge>
                        <span className="font-semibold text-slate-800">
                          {formatINR(f.costAtTime)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTimeIN(new Date(f.dateTime))}
                        {f.notes ? ` • ${f.notes}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditFeed(f)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleting({
                            kind: "feed",
                            id: f.id,
                            title: `Delete Feed Log (${f.crabCode})`,
                            description: `Delete ${formatNumberIN(f.quantityG, 0)} g of ${f.feedName} (${formatINR(f.costAtTime)}) logged for crab ${f.crabCode}?`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {logsTab === "weights" &&
            (todayLogs.weightLogs.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No weight measurements logged today.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {todayLogs.weightLogs.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 flex items-center justify-between gap-2"
                  >
                    <div className="text-sm">
                      <Link
                        href={`/crabs/${w.crabId}`}
                        className="font-mono font-bold text-teal-800 hover:underline mr-2"
                      >
                        {w.crabCode}
                      </Link>
                      <span className="font-semibold text-slate-900">
                        {formatNumberIN(w.weightG, 0)} g
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {formatDateIN(new Date(w.date))}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditWeight(w)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleting({
                            kind: "weight",
                            id: w.id,
                            title: `Delete Weight Log (${w.crabCode})`,
                            description: `Delete ${formatNumberIN(w.weightG, 0)} g measurement for crab ${w.crabCode}?`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {logsTab === "molts" &&
            (todayLogs.moltLogs.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No molt logs recorded today.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {todayLogs.moltLogs.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/crabs/${m.crabId}`}
                          className="font-mono font-bold text-teal-800 hover:underline"
                        >
                          {m.crabCode}
                        </Link>
                        <Badge
                          variant={
                            m.stage === "SOFT" || m.stage === "MOLTED"
                              ? "warning"
                              : "default"
                          }
                        >
                          {m.stage}
                        </Badge>
                        {m.weightAfterG !== null && (
                          <span className="font-semibold">
                            {formatNumberIN(m.weightAfterG, 0)} g
                          </span>
                        )}
                      </div>
                      {m.notes && (
                        <div className="text-xs text-slate-600 mt-0.5">{m.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditMolt(m)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleting({
                            kind: "molt",
                            id: m.id,
                            title: `Delete Molt Log (${m.crabCode})`,
                            description: `Delete ${m.stage} molt entry for crab ${m.crabCode}?`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {logsTab === "water" &&
            (todayLogs.waterTests.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No water tests logged today.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {todayLogs.waterTests.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-slate-900">
                        {formatDateTimeIN(new Date(w.dateTime))}
                      </div>
                      <div className="text-slate-700 flex flex-wrap gap-x-3 gap-y-0.5">
                        {w.salinityPpt !== null && (
                          <span>Sal: {formatNumberIN(w.salinityPpt, 1)} ppt</span>
                        )}
                        {w.pH !== null && <span>pH: {formatNumberIN(w.pH, 2)}</span>}
                        {w.ammoniaMgL !== null && (
                          <span>NH₃: {formatNumberIN(w.ammoniaMgL, 2)} mg/L</span>
                        )}
                        {w.nitriteMgL !== null && (
                          <span>NO₂: {formatNumberIN(w.nitriteMgL, 2)} mg/L</span>
                        )}
                        {w.nitrateMgL !== null && (
                          <span>NO₃: {formatNumberIN(w.nitrateMgL, 1)} mg/L</span>
                        )}
                        {w.alkalinityMgL !== null && (
                          <span>Alk: {formatNumberIN(w.alkalinityMgL, 0)} mg/L</span>
                        )}
                        {w.temperatureC !== null && (
                          <span>Temp: {formatNumberIN(w.temperatureC, 1)} °C</span>
                        )}
                        {w.dissolvedOxygenMgL !== null && (
                          <span>DO: {formatNumberIN(w.dissolvedOxygenMgL, 1)} mg/L</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditWater(w)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleting({
                            kind: "water",
                            id: w.id,
                            title: "Delete Water Test",
                            description: `Delete whole-RAS water test from ${formatDateTimeIN(
                              new Date(w.dateTime)
                            )}?`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Edit Feed Dialog */}
      <Dialog
        open={Boolean(editFeed)}
        onOpenChange={(open) => {
          if (!open) setEditFeed(null);
        }}
        title={editFeed ? `Edit Feed (${editFeed.crabCode})` : "Edit Feed"}
      >
        <form onSubmit={handleSaveEditFeed} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dl-ef-dt">Date &amp; Time *</Label>
              <Input
                id="dl-ef-dt"
                type="datetime-local"
                value={efDateTime}
                onChange={(e) => setEfDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dl-ef-slot">Time Slot</Label>
              <Select
                id="dl-ef-slot"
                value={efSlot}
                onChange={(e) =>
                  setEfSlot(e.target.value as "MORNING" | "EVENING" | "NIGHT")
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
              <Label htmlFor="dl-ef-type">Feed Type *</Label>
              <Select
                id="dl-ef-type"
                value={efFeedTypeId}
                onChange={(e) => {
                  setEfFeedTypeId(e.target.value);
                  recalcFeedEditCost(e.target.value, efQtyG);
                }}
                required
              >
                {editFeedTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name} ({formatINR(ft.costPerKg)}/kg)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="dl-ef-qty">Quantity (g) *</Label>
              <Input
                id="dl-ef-qty"
                type="number"
                step="any"
                min="0.1"
                value={efQtyG}
                onChange={(e) => {
                  setEfQtyG(e.target.value);
                  recalcFeedEditCost(efFeedTypeId, e.target.value);
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor="dl-ef-cost">Cost at Time (₹) *</Label>
              <Input
                id="dl-ef-cost"
                type="number"
                step="any"
                min="0"
                value={efCostAtTime}
                onChange={(e) => setEfCostAtTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dl-ef-notes">Notes (optional)</Label>
            <Textarea
              id="dl-ef-notes"
              value={efNotes}
              onChange={(e) => setEfNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditFeed(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editPending}>
              {editPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Weight Dialog */}
      <Dialog
        open={Boolean(editWeight)}
        onOpenChange={(open) => {
          if (!open) setEditWeight(null);
        }}
        title={editWeight ? `Edit Weight (${editWeight.crabCode})` : "Edit Weight"}
      >
        <form onSubmit={handleSaveEditWeight} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dl-ew-date">Date *</Label>
              <Input
                id="dl-ew-date"
                type="date"
                value={ewDate}
                onChange={(e) => setEwDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dl-ew-g">Weight (g) *</Label>
              <Input
                id="dl-ew-g"
                type="number"
                step="any"
                min="1"
                value={ewWeightG}
                onChange={(e) => setEwWeightG(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditWeight(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editPending}>
              {editPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Molt Dialog */}
      <Dialog
        open={Boolean(editMolt)}
        onOpenChange={(open) => {
          if (!open) setEditMolt(null);
        }}
        title={editMolt ? `Edit Molt (${editMolt.crabCode})` : "Edit Molt"}
      >
        <form onSubmit={handleSaveEditMolt} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="dl-em-date">Date *</Label>
              <Input
                id="dl-em-date"
                type="date"
                value={emDate}
                onChange={(e) => setEmDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dl-em-stage">Stage</Label>
              <Select
                id="dl-em-stage"
                value={emStage}
                onChange={(e) =>
                  setEmStage(
                    e.target.value as
                      | "PRE_MOLT"
                      | "MOLTED"
                      | "SOFT"
                      | "HARDENING"
                      | "HARD"
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
            <div>
              <Label htmlFor="dl-em-wt">Weight After (g)</Label>
              <Input
                id="dl-em-wt"
                type="number"
                step="any"
                min="1"
                value={emWeightAfterG}
                onChange={(e) => setEmWeightAfterG(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dl-em-notes">Notes (optional)</Label>
            <Textarea
              id="dl-em-notes"
              value={emNotes}
              onChange={(e) => setEmNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditMolt(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editPending}>
              {editPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Water Test Dialog */}
      <Dialog
        open={Boolean(editWater)}
        onOpenChange={(open) => {
          if (!open) setEditWater(null);
        }}
        title="Edit Water Test"
      >
        <form onSubmit={handleSaveEditWater} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Label htmlFor="dl-ewt-dt">Date &amp; Time *</Label>
              <Input
                id="dl-ewt-dt"
                type="datetime-local"
                value={ewtDateTime}
                onChange={(e) => setEwtDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-sal">Salinity (ppt)</Label>
              <Input
                id="dl-ewt-sal"
                type="number"
                step="any"
                min="0"
                value={ewtSal}
                onChange={(e) => setEwtSal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-ph">pH</Label>
              <Input
                id="dl-ewt-ph"
                type="number"
                step="any"
                min="0"
                max="14"
                value={ewtPh}
                onChange={(e) => setEwtPh(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-nh3">Ammonia (mg/L)</Label>
              <Input
                id="dl-ewt-nh3"
                type="number"
                step="any"
                min="0"
                value={ewtNh3}
                onChange={(e) => setEwtNh3(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-no2">Nitrite (mg/L)</Label>
              <Input
                id="dl-ewt-no2"
                type="number"
                step="any"
                min="0"
                value={ewtNo2}
                onChange={(e) => setEwtNo2(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-no3">Nitrate (mg/L)</Label>
              <Input
                id="dl-ewt-no3"
                type="number"
                step="any"
                min="0"
                value={ewtNo3}
                onChange={(e) => setEwtNo3(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-alk">Alkalinity (mg/L CaCO₃)</Label>
              <Input
                id="dl-ewt-alk"
                type="number"
                step="any"
                min="0"
                value={ewtAlk}
                onChange={(e) => setEwtAlk(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-temp">Temp (°C)</Label>
              <Input
                id="dl-ewt-temp"
                type="number"
                step="any"
                min="0"
                value={ewtTemp}
                onChange={(e) => setEwtTemp(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dl-ewt-do">DO (mg/L)</Label>
              <Input
                id="dl-ewt-do"
                type="number"
                step="any"
                min="0"
                value={ewtDo}
                onChange={(e) => setEwtDo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dl-ewt-notes">Notes (optional)</Label>
            <Textarea
              id="dl-ewt-notes"
              value={ewtNotes}
              onChange={(e) => setEwtNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditWater(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editPending}>
              {editPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting?.title ?? "Delete Entry"}
        description={deleting?.description ?? ""}
        pending={deletePending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
