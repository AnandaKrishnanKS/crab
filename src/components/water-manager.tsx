"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Edit3,
  FlaskConical,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  addMineralAdditionAction,
  addSystemLogAction,
  addWaterChangeAction,
  addWaterTestAction,
  deleteMineralAdditionAction,
  deleteSystemLogAction,
  deleteWaterChangeAction,
  deleteWaterTestAction,
  updateMineralAdditionAction,
  updateSystemLogAction,
  updateWaterChangeAction,
  updateWaterTestAction,
} from "@/app/actions/water";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MonthlyChemicalsChart,
  type MonthlyChemicalChartPoint,
  type WaterChartThresholds,
  WaterTrendCharts,
  type WaterTestPoint,
} from "@/components/water-charts";
import {
  WaterDoseCalculator,
  type WaterMineralItem,
} from "@/components/water-dose-calculator";
import {
  formatChemicalFormula,
  formatDateIN,
  formatDateTimeIN,
  formatINR,
  formatMineralQuantityG,
  formatNumberIN,
  toISTDateString,
  toISTDateTimeInput,
} from "@/lib/format";
import {
  type AddedIonsMg,
  computeAddedIonsMg,
  computeWaterRatios,
} from "@/lib/water";

export type WaterTabId =
  | "tests"
  | "changes"
  | "chemicals"
  | "calculator"
  | "maintenance";

export interface WaterTestItem {
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

export interface WaterChangeItem {
  id: string;
  date: string;
  quantityLitres: number;
  percentChanged: number;
  calciumMgL: number | null;
  magnesiumMgL: number | null;
  potassiumMgL: number | null;
  sodiumMgL: number | null;
  notes: string | null;
  ratios: { mgToCa: number | null; naToK: number | null; caToK: number | null };
  chemicals: Array<{
    id: string;
    mineralName: string;
    formula: string;
    quantityG: number;
    costAtTime: number;
  }>;
  ionTotals: AddedIonsMg;
}

export interface MineralAdditionItem {
  id: string;
  dateTime: string;
  mineralId: string;
  mineralName: string;
  formula: string;
  quantityG: number;
  costAtTime: number;
  reason: "SALINITY_ADJUST" | "PH_ADJUST" | "WATER_CHANGE" | "TOP_UP" | "OTHER";
  waterChangeId: string | null;
  waterChangeDateLabel: string | null;
  notes: string | null;
  ionsMg: AddedIonsMg;
}

export interface WeeklyIonRow {
  weekKey: string;
  weekLabel: string;
  totalG: number;
  totalCost: number;
  ionsMg: AddedIonsMg;
}

export interface SystemLogItem {
  id: string;
  date: string;
  type:
    | "TOP_UP"
    | "BIOFILTER_CLEAN"
    | "MECHANICAL_FILTER_CLEAN"
    | "UV_SERVICE"
    | "PUMP_SERVICE"
    | "OTHER";
  quantityLitres: number | null;
  cost: number | null;
  notes: string | null;
}

function IonsLine({ ions }: { ions: AddedIonsMg }) {
  const parts: string[] = [];
  if (ions.naMg > 0) parts.push(`Na ${formatNumberIN(ions.naMg, 0)} mg`);
  if (ions.mgMg > 0) parts.push(`Mg ${formatNumberIN(ions.mgMg, 0)} mg`);
  if (ions.caMg > 0) parts.push(`Ca ${formatNumberIN(ions.caMg, 0)} mg`);
  if (ions.kMg > 0) parts.push(`K ${formatNumberIN(ions.kMg, 0)} mg`);
  if (ions.clMg > 0) parts.push(`Cl ${formatNumberIN(ions.clMg, 0)} mg`);
  if (ions.so4Mg > 0) parts.push(`SO₄ ${formatNumberIN(ions.so4Mg, 0)} mg`);
  if (ions.hco3Mg > 0) parts.push(`HCO₃ ${formatNumberIN(ions.hco3Mg, 0)} mg`);
  if (parts.length === 0) return null;
  return <span className="text-[11px] text-slate-600">{parts.join(" • ")}</span>;
}

const SYSTEM_LOG_LABELS: Record<SystemLogItem["type"], string> = {
  TOP_UP: "Top-up Water",
  BIOFILTER_CLEAN: "Biofilter Clean",
  MECHANICAL_FILTER_CLEAN: "Mechanical Filter Clean",
  UV_SERVICE: "UV Service",
  PUMP_SERVICE: "Pump Service",
  OTHER: "Other Maintenance",
};

interface DraftChemRow {
  mineralId: string;
  quantityG: string;
  costAtTime: string;
  notes: string;
}

export function WaterManager({
  initialTab,
  openNewOnLoad,
  defaultDateYmd,
  defaultDateTimeLocal,
  thresholds,
  lowMineralStockKg,
  systemVolumeLitres,
  waterTests,
  waterChanges,
  minerals,
  mineralAdditions,
  monthlyChemData,
  weeklyIonTotals,
  systemLogs,
}: {
  initialTab: WaterTabId;
  openNewOnLoad: boolean;
  defaultDateYmd: string;
  defaultDateTimeLocal: string;
  thresholds: WaterChartThresholds;
  lowMineralStockKg: number;
  systemVolumeLitres: number;
  waterTests: WaterTestItem[];
  waterChanges: WaterChangeItem[];
  minerals: WaterMineralItem[];
  mineralAdditions: MineralAdditionItem[];
  monthlyChemData: MonthlyChemicalChartPoint[];
  weeklyIonTotals: WeeklyIonRow[];
  systemLogs: SystemLogItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<WaterTabId>(initialTab);

  const activeMinerals = minerals.filter((m) => m.active);
  const firstMineralId = activeMinerals[0]?.id ?? minerals[0]?.id ?? "";

  // ---- Shared Delete Dialog ----
  const [deleteTarget, setDeleteTarget] = React.useState<{
    kind: "test" | "change" | "addition" | "maintenance";
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res =
      deleteTarget.kind === "test"
        ? await deleteWaterTestAction(deleteTarget.id)
        : deleteTarget.kind === "change"
        ? await deleteWaterChangeAction(deleteTarget.id)
        : deleteTarget.kind === "addition"
        ? await deleteMineralAdditionAction(deleteTarget.id)
        : await deleteSystemLogAction(deleteTarget.id);
    setDeletePending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Deleted");
    setDeleteTarget(null);
    router.refresh();
  };

  // ---- TAB 1: Water Test Modal (Add & Edit) ----
  const [wtDialogOpen, setWtDialogOpen] = React.useState(
    initialTab === "tests" && openNewOnLoad
  );
  const [editingTestId, setEditingTestId] = React.useState<string | null>(null);
  const [wtDateTime, setWtDateTime] = React.useState(defaultDateTimeLocal);
  const [wtSal, setWtSal] = React.useState("");
  const [wtPh, setWtPh] = React.useState("");
  const [wtNh3, setWtNh3] = React.useState("");
  const [wtNo2, setWtNo2] = React.useState("");
  const [wtNo3, setWtNo3] = React.useState("");
  const [wtAlk, setWtAlk] = React.useState("");
  const [wtTemp, setWtTemp] = React.useState("");
  const [wtDo, setWtDo] = React.useState("");
  const [wtNotes, setWtNotes] = React.useState("");
  const [wtPending, setWtPending] = React.useState(false);

  const openAddTest = () => {
    setEditingTestId(null);
    setWtDateTime(defaultDateTimeLocal);
    setWtSal("");
    setWtPh("");
    setWtNh3("");
    setWtNo2("");
    setWtNo3("");
    setWtAlk("");
    setWtTemp("");
    setWtDo("");
    setWtNotes("");
    setWtDialogOpen(true);
  };

  const openEditTest = (row: WaterTestItem) => {
    setEditingTestId(row.id);
    setWtDateTime(toISTDateTimeInput(new Date(row.dateTime)));
    setWtSal(row.salinityPpt !== null ? String(row.salinityPpt) : "");
    setWtPh(row.pH !== null ? String(row.pH) : "");
    setWtNh3(row.ammoniaMgL !== null ? String(row.ammoniaMgL) : "");
    setWtNo2(row.nitriteMgL !== null ? String(row.nitriteMgL) : "");
    setWtNo3(row.nitrateMgL !== null ? String(row.nitrateMgL) : "");
    setWtAlk(row.alkalinityMgL !== null ? String(row.alkalinityMgL) : "");
    setWtTemp(row.temperatureC !== null ? String(row.temperatureC) : "");
    setWtDo(row.dissolvedOxygenMgL !== null ? String(row.dissolvedOxygenMgL) : "");
    setWtNotes(row.notes ?? "");
    setWtDialogOpen(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWtPending(true);
    const payload = {
      id: editingTestId ?? undefined,
      dateTime: wtDateTime,
      salinityPpt: wtSal,
      pH: wtPh,
      ammoniaMgL: wtNh3,
      nitriteMgL: wtNo2,
      nitrateMgL: wtNo3,
      alkalinityMgL: wtAlk,
      temperatureC: wtTemp,
      dissolvedOxygenMgL: wtDo,
      notes: wtNotes,
    };
    const res = editingTestId
      ? await updateWaterTestAction(payload)
      : await addWaterTestAction(payload);
    setWtPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Saved water test");
    setWtDialogOpen(false);
    router.refresh();
  };

  const trendPoints: WaterTestPoint[] = [...waterTests]
    .reverse()
    .map((t) => ({
      dateLabel: formatDateIN(new Date(t.dateTime)).slice(0, 5),
      salinityPpt: t.salinityPpt,
      pH: t.pH,
      alkalinityMgL: t.alkalinityMgL,
      ammoniaMgL: t.ammoniaMgL,
      nitriteMgL: t.nitriteMgL,
      nitrateMgL: t.nitrateMgL,
    }));

  // ---- TAB 2: Water Changes Modal (Add with Chemicals, Edit readings) ----
  const [wcDialogOpen, setWcDialogOpen] = React.useState(
    initialTab === "changes" && openNewOnLoad
  );
  const [editingWcId, setEditingWcId] = React.useState<string | null>(null);
  const [wcDate, setWcDate] = React.useState(defaultDateYmd);
  const [wcQtyL, setWcQtyL] = React.useState(String(systemVolumeLitres));
  const [wcPct, setWcPct] = React.useState("100");
  const [wcCa, setWcCa] = React.useState("");
  const [wcMg, setWcMg] = React.useState("");
  const [wcK, setWcK] = React.useState("");
  const [wcNa, setWcNa] = React.useState("");
  const [wcNotes, setWcNotes] = React.useState("");
  const [wcChemicals, setWcChemicals] = React.useState<DraftChemRow[]>([]);
  const [wcPending, setWcPending] = React.useState(false);

  const openAddWaterChange = () => {
    setEditingWcId(null);
    setWcDate(defaultDateYmd);
    setWcQtyL(String(systemVolumeLitres));
    setWcPct("100");
    setWcCa("");
    setWcMg("");
    setWcK("");
    setWcNa("");
    setWcNotes("");
    setWcChemicals([]);
    setWcDialogOpen(true);
  };

  const openEditWaterChange = (row: WaterChangeItem) => {
    setEditingWcId(row.id);
    setWcDate(toISTDateString(new Date(row.date)));
    setWcQtyL(String(row.quantityLitres));
    setWcPct(String(row.percentChanged));
    setWcCa(row.calciumMgL !== null ? String(row.calciumMgL) : "");
    setWcMg(row.magnesiumMgL !== null ? String(row.magnesiumMgL) : "");
    setWcK(row.potassiumMgL !== null ? String(row.potassiumMgL) : "");
    setWcNa(row.sodiumMgL !== null ? String(row.sodiumMgL) : "");
    setWcNotes(row.notes ?? "");
    setWcChemicals([]);
    setWcDialogOpen(true);
  };

  const liveWcRatios = computeWaterRatios({
    calciumMgL: wcCa ? Number(wcCa) : null,
    magnesiumMgL: wcMg ? Number(wcMg) : null,
    potassiumMgL: wcK ? Number(wcK) : null,
    sodiumMgL: wcNa ? Number(wcNa) : null,
  });

  const handleSaveWaterChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setWcPending(true);
    const validChemicals = wcChemicals
      .filter((c) => Number(c.quantityG) > 0 && c.mineralId)
      .map((c) => ({
        mineralId: c.mineralId,
        quantityG: Number(c.quantityG),
        costAtTime: c.costAtTime,
        notes: c.notes,
      }));

    const res = editingWcId
      ? await updateWaterChangeAction({
          id: editingWcId,
          date: wcDate,
          quantityLitres: Number(wcQtyL),
          percentChanged: Number(wcPct),
          calciumMgL: wcCa,
          magnesiumMgL: wcMg,
          potassiumMgL: wcK,
          sodiumMgL: wcNa,
          notes: wcNotes,
        })
      : await addWaterChangeAction({
          date: wcDate,
          quantityLitres: Number(wcQtyL),
          percentChanged: Number(wcPct),
          calciumMgL: wcCa,
          magnesiumMgL: wcMg,
          potassiumMgL: wcK,
          sodiumMgL: wcNa,
          notes: wcNotes,
          chemicals: validChemicals,
        });
    setWcPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Water change saved");
    setWcDialogOpen(false);
    router.refresh();
  };

  // ---- TAB 3: Standalone Chemical Additions ----
  const [chemDialogOpen, setChemDialogOpen] = React.useState(
    initialTab === "chemicals" && openNewOnLoad
  );
  const [editingChemId, setEditingChemId] = React.useState<string | null>(null);
  const [maDateTime, setMaDateTime] = React.useState(defaultDateTimeLocal);
  const [maMineralId, setMaMineralId] = React.useState(firstMineralId);
  const [maQtyG, setMaQtyG] = React.useState("");
  const [maCost, setMaCost] = React.useState("");
  const [maReason, setMaReason] =
    React.useState<MineralAdditionItem["reason"]>("SALINITY_ADJUST");
  const [maWaterChangeId, setMaWaterChangeId] = React.useState("");
  const [maNotes, setMaNotes] = React.useState("");
  const [maPending, setMaPending] = React.useState(false);

  const recalcStandaloneCost = (mId: string, qtyStr: string) => {
    const m = minerals.find((x) => x.id === mId);
    const qty = Number(qtyStr);
    if (m && Number.isFinite(qty) && qty >= 0) {
      setMaCost(String(Math.round((qty / 1000) * Number(m.costPerKg) * 100) / 100));
    }
  };

  const openAddChemical = () => {
    setEditingChemId(null);
    setMaDateTime(defaultDateTimeLocal);
    setMaMineralId(firstMineralId);
    setMaQtyG("");
    setMaCost("");
    setMaReason("SALINITY_ADJUST");
    setMaWaterChangeId("");
    setMaNotes("");
    setChemDialogOpen(true);
  };

  const openEditChemical = (row: MineralAdditionItem) => {
    setEditingChemId(row.id);
    setMaDateTime(toISTDateTimeInput(new Date(row.dateTime)));
    setMaMineralId(row.mineralId);
    setMaQtyG(String(row.quantityG));
    setMaCost(String(row.costAtTime));
    setMaReason(row.reason);
    setMaWaterChangeId(row.waterChangeId ?? "");
    setMaNotes(row.notes ?? "");
    setChemDialogOpen(true);
  };

  const handleSaveChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaPending(true);
    const payload = {
      id: editingChemId ?? undefined,
      dateTime: maDateTime,
      mineralId: maMineralId,
      quantityG: Number(maQtyG),
      costAtTime: maCost,
      reason: maReason,
      waterChangeId: maWaterChangeId || null,
      notes: maNotes,
    };
    const res = editingChemId
      ? await updateMineralAdditionAction(payload)
      : await addMineralAdditionAction(payload);
    setMaPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Chemical addition saved");
    setChemDialogOpen(false);
    router.refresh();
  };

  const selectedStandaloneMineral = minerals.find((m) => m.id === maMineralId);
  const standaloneIonsPreview =
    selectedStandaloneMineral && Number(maQtyG) > 0
      ? computeAddedIonsMg(Number(maQtyG), selectedStandaloneMineral)
      : null;

  // ---- TAB 5: System Maintenance Logs ----
  const [maintDialogOpen, setMaintDialogOpen] = React.useState(
    initialTab === "maintenance" && openNewOnLoad
  );
  const [editingMaintId, setEditingMaintId] = React.useState<string | null>(null);
  const [slDate, setSlDate] = React.useState(defaultDateYmd);
  const [slType, setSlType] = React.useState<SystemLogItem["type"]>("TOP_UP");
  const [slQtyL, setSlQtyL] = React.useState("");
  const [slCost, setSlCost] = React.useState("");
  const [slNotes, setSlNotes] = React.useState("");
  const [slPending, setSlPending] = React.useState(false);

  const openAddMaintenance = () => {
    setEditingMaintId(null);
    setSlDate(defaultDateYmd);
    setSlType("TOP_UP");
    setSlQtyL("");
    setSlCost("");
    setSlNotes("");
    setMaintDialogOpen(true);
  };

  const openEditMaintenance = (row: SystemLogItem) => {
    setEditingMaintId(row.id);
    setSlDate(toISTDateString(new Date(row.date)));
    setSlType(row.type);
    setSlQtyL(row.quantityLitres !== null ? String(row.quantityLitres) : "");
    setSlCost(row.cost !== null ? String(row.cost) : "");
    setSlNotes(row.notes ?? "");
    setMaintDialogOpen(true);
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlPending(true);
    const payload = {
      id: editingMaintId ?? undefined,
      date: slDate,
      type: slType,
      quantityLitres: slQtyL,
      cost: slCost,
      notes: slNotes,
    };
    const res = editingMaintId
      ? await updateSystemLogAction(payload)
      : await addSystemLogAction(payload);
    setSlPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Maintenance log saved");
    setMaintDialogOpen(false);
    router.refresh();
  };

  const latestTest = waterTests[0] ?? null;
  const latestChange = waterChanges[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          RAS Water Management
        </h1>
        <p className="text-sm text-slate-600">
          Shared whole-system water tests, water changes, mineral chemistry, dose calculator, and
          RAS maintenance.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "tests", label: "Water Tests", count: waterTests.length },
          { id: "changes", label: "Water Changes", count: waterChanges.length },
          { id: "chemicals", label: "Chemicals Used", count: mineralAdditions.length },
          { id: "calculator", label: "Dose Calculator" },
          { id: "maintenance", label: "Maintenance Log", count: systemLogs.length },
        ]}
      />

      {/* TAB 1: WATER TESTS */}
      {tab === "tests" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Dashed reference lines show your acceptable limits configured in Settings.
            </p>
            <Button onClick={openAddTest}>
              <Plus className="h-4 w-4" />
              Log Water Test
            </Button>
          </div>

          <WaterTrendCharts points={trendPoints} thresholds={thresholds} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Water Test History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {waterTests.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-600">
                  No water tests recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {waterTests.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatDateTimeIN(new Date(t.dateTime))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-700">
                          {t.salinityPpt !== null && (
                            <span>Sal: {formatNumberIN(t.salinityPpt, 1)} ppt</span>
                          )}
                          {t.pH !== null && <span>pH: {formatNumberIN(t.pH, 2)}</span>}
                          {t.ammoniaMgL !== null && (
                            <span>NH₃: {formatNumberIN(t.ammoniaMgL, 2)} mg/L</span>
                          )}
                          {t.nitriteMgL !== null && (
                            <span>NO₂: {formatNumberIN(t.nitriteMgL, 2)} mg/L</span>
                          )}
                          {t.nitrateMgL !== null && (
                            <span>NO₃: {formatNumberIN(t.nitrateMgL, 1)} mg/L</span>
                          )}
                          {t.alkalinityMgL !== null && (
                            <span>Alk: {formatNumberIN(t.alkalinityMgL, 0)} mg/L</span>
                          )}
                          {t.temperatureC !== null && (
                            <span>Temp: {formatNumberIN(t.temperatureC, 1)} °C</span>
                          )}
                          {t.dissolvedOxygenMgL !== null && (
                            <span>DO: {formatNumberIN(t.dissolvedOxygenMgL, 1)} mg/L</span>
                          )}
                        </div>
                        {t.notes && <div className="text-slate-500">{t.notes}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditTest(t)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "test",
                              id: t.id,
                              title: "Delete Water Test?",
                              description: `Delete whole-RAS water test from ${formatDateTimeIN(
                                new Date(t.dateTime)
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
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: WATER CHANGES */}
      {tab === "changes" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Full RAS water changes (~every 3–4 months) with baseline mineral ions &amp; initial
              salts added.
            </p>
            <Button onClick={openAddWaterChange}>
              <RefreshCw className="h-4 w-4" />
              Log Water Change
            </Button>
          </div>

          {waterChanges.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-600">
                No water changes logged yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {waterChanges.map((wc) => (
                <Card key={wc.id}>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-extrabold text-slate-900">
                            {formatDateIN(new Date(wc.date))}
                          </span>
                          <Badge variant="teal">
                            {formatNumberIN(wc.quantityLitres, 0)} L (
                            {formatNumberIN(wc.percentChanged, 0)}%)
                          </Badge>
                          {wc.ratios.mgToCa !== null && (
                            <Badge variant="default">Mg:Ca {wc.ratios.mgToCa}:1</Badge>
                          )}
                          {wc.ratios.naToK !== null && (
                            <Badge variant="default">Na:K {wc.ratios.naToK}:1</Badge>
                          )}
                          {wc.ratios.caToK !== null && (
                            <Badge variant="default">Ca:K {wc.ratios.caToK}:1</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-700 flex flex-wrap gap-x-3 gap-y-0.5">
                          {wc.calciumMgL !== null && (
                            <span>Ca: {formatNumberIN(wc.calciumMgL, 1)} mg/L</span>
                          )}
                          {wc.magnesiumMgL !== null && (
                            <span>Mg: {formatNumberIN(wc.magnesiumMgL, 1)} mg/L</span>
                          )}
                          {wc.potassiumMgL !== null && (
                            <span>K: {formatNumberIN(wc.potassiumMgL, 1)} mg/L</span>
                          )}
                          {wc.sodiumMgL !== null && (
                            <span>Na: {formatNumberIN(wc.sodiumMgL, 1)} mg/L</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditWaterChange(wc)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "change",
                              id: wc.id,
                              title: `Delete Water Change (${formatDateIN(
                                new Date(wc.date)
                              )})?`,
                              description:
                                wc.chemicals.length > 0
                                  ? `Deleting this water change will also permanently delete its ${
                                      wc.chemicals.length
                                    } linked chemical addition(s) (${wc.chemicals
                                      .map(
                                        (c) =>
                                          `${formatChemicalFormula(c.formula)} ${formatMineralQuantityG(
                                            c.quantityG
                                          )}`
                                      )
                                      .join(", ")}) and restore those grams back to tracked mineral stock.`
                                  : `Are you sure you want to delete this water change record?`,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {wc.chemicals.length > 0 && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
                        <div className="text-xs font-semibold text-slate-800">
                          Chemicals Added During Change ({wc.chemicals.length}):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {wc.chemicals.map((ch) => (
                            <span
                              key={ch.id}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800"
                            >
                              <span className="font-semibold">
                                {formatChemicalFormula(ch.formula)}
                              </span>
                              <span>{formatMineralQuantityG(ch.quantityG)}</span>
                              <span className="text-slate-500">
                                ({formatINR(ch.costAtTime)})
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="pt-0.5">
                          <span className="text-[11px] font-semibold text-slate-700 mr-1.5">
                            Total ions added:
                          </span>
                          <IonsLine ions={wc.ionTotals} />
                        </div>
                      </div>
                    )}

                    {wc.notes && <p className="text-xs text-slate-600">{wc.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHEMICALS USED */}
      {tab === "chemicals" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Monitor chemical stock (kg), monthly ₹ spend, weekly ion totals, and adjust records.
            </p>
            <Button onClick={openAddChemical}>
              <FlaskConical className="h-4 w-4" />
              Add Chemical
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeMinerals.map((m) => {
              const isLow =
                m.stockKg !== null && m.stockKg <= lowMineralStockKg;
              return (
                <Card key={m.id} className={isLow ? "border-amber-300 bg-amber-50/40" : ""}>
                  <CardContent className="p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {m.name}{" "}
                        <span className="font-mono text-xs text-slate-600">
                          ({formatChemicalFormula(m.formula)})
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatINR(Number(m.costPerKg))}/kg
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {m.stockKg !== null ? (
                        <Badge variant={isLow ? "warning" : "success"}>
                          {isLow && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {formatNumberIN(m.stockKg, 2)} kg
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">Not tracked</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <MonthlyChemicalsChart data={monthlyChemData} />

          {weeklyIonTotals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ion Totals Added per Week</CardTitle>
                <CardDescription>
                  Combined ion mass (mg) dosed per IST week (Monday start).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {weeklyIonTotals.map((wk) => (
                    <div key={wk.weekKey} className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-900">{wk.weekLabel}</span>
                        <span className="font-semibold text-slate-800">
                          {formatMineralQuantityG(wk.totalG)} • {formatINR(wk.totalCost)}
                        </span>
                      </div>
                      <IonsLine ions={wk.ionsMg} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chemical Addition History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {mineralAdditions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-600">
                  No chemical additions recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {mineralAdditions.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold text-slate-900">
                            {a.mineralName} ({formatChemicalFormula(a.formula)})
                          </span>
                          <span className="font-semibold text-teal-900">
                            {formatMineralQuantityG(a.quantityG)}
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatINR(a.costAtTime)}
                          </span>
                          <Badge variant="default">{a.reason}</Badge>
                          {a.waterChangeDateLabel && (
                            <Badge variant="teal">WC {a.waterChangeDateLabel}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTimeIN(new Date(a.dateTime))}
                          {a.notes ? ` • ${a.notes}` : ""}
                        </div>
                        <IonsLine ions={a.ionsMg} />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditChemical(a)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "addition",
                              id: a.id,
                              title: `Delete Chemical Addition?`,
                              description: `Delete ${a.mineralName} (${formatMineralQuantityG(
                                a.quantityG
                              )}, ${formatINR(
                                a.costAtTime
                              )})? Tracked stock in kg will be restored if enabled.`,
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
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: DOSE CALCULATOR */}
      {tab === "calculator" && (
        <WaterDoseCalculator
          minerals={minerals}
          defaultVolumeLitres={systemVolumeLitres}
          defaultDateTimeLocal={defaultDateTimeLocal}
          latestSalinityPpt={latestTest?.salinityPpt ?? null}
          latestAlkMgL={latestTest?.alkalinityMgL ?? null}
          latestCaMgL={latestChange?.calciumMgL ?? null}
          latestMgMgL={latestChange?.magnesiumMgL ?? null}
          latestKMgL={latestChange?.potassiumMgL ?? null}
        />
      )}

      {/* TAB 5: MAINTENANCE LOG */}
      {tab === "maintenance" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Track RAS top-ups, biofilter &amp; mechanical filter cleanings, UV &amp; pump servicing.
            </p>
            <Button onClick={openAddMaintenance}>
              <Wrench className="h-4 w-4" />
              Log Maintenance
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">RAS Maintenance History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {systemLogs.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-600">
                  No maintenance events logged yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {systemLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold text-slate-900">
                            {formatDateIN(new Date(log.date))}
                          </span>
                          <Badge variant="default">
                            {SYSTEM_LOG_LABELS[log.type]}
                          </Badge>
                          {log.quantityLitres !== null && (
                            <span className="font-semibold text-teal-900">
                              {formatNumberIN(log.quantityLitres, 0)} L
                            </span>
                          )}
                          {log.cost !== null && (
                            <span className="font-bold text-slate-900">
                              {formatINR(log.cost)}
                            </span>
                          )}
                        </div>
                        {log.notes && (
                          <div className="text-xs text-slate-600">{log.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditMaintenance(log)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "maintenance",
                              id: log.id,
                              title: "Delete Maintenance Log?",
                              description: `Delete ${SYSTEM_LOG_LABELS[log.type]} logged on ${formatDateIN(
                                new Date(log.date)
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
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* DIALOG: Add / Edit Water Test */}
      <Dialog
        open={wtDialogOpen}
        onOpenChange={setWtDialogOpen}
        title={editingTestId ? "Edit Water Test" : "Log Water Test"}
        description="Whole-RAS measurement. Only date & time are required."
      >
        <form onSubmit={handleSaveTest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Label htmlFor="wm-wt-dt">Date &amp; Time *</Label>
              <Input
                id="wm-wt-dt"
                type="datetime-local"
                value={wtDateTime}
                onChange={(e) => setWtDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-sal">Salinity (ppt)</Label>
              <Input
                id="wm-wt-sal"
                type="number"
                step="any"
                min="0"
                value={wtSal}
                onChange={(e) => setWtSal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-ph">pH</Label>
              <Input
                id="wm-wt-ph"
                type="number"
                step="any"
                min="0"
                max="14"
                value={wtPh}
                onChange={(e) => setWtPh(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-nh3">Ammonia (mg/L)</Label>
              <Input
                id="wm-wt-nh3"
                type="number"
                step="any"
                min="0"
                value={wtNh3}
                onChange={(e) => setWtNh3(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-no2">Nitrite (mg/L)</Label>
              <Input
                id="wm-wt-no2"
                type="number"
                step="any"
                min="0"
                value={wtNo2}
                onChange={(e) => setWtNo2(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-no3">Nitrate (mg/L)</Label>
              <Input
                id="wm-wt-no3"
                type="number"
                step="any"
                min="0"
                value={wtNo3}
                onChange={(e) => setWtNo3(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-alk">Alkalinity (mg/L CaCO₃)</Label>
              <Input
                id="wm-wt-alk"
                type="number"
                step="any"
                min="0"
                value={wtAlk}
                onChange={(e) => setWtAlk(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-temp">Temp (°C)</Label>
              <Input
                id="wm-wt-temp"
                type="number"
                step="any"
                min="0"
                value={wtTemp}
                onChange={(e) => setWtTemp(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wm-wt-do">DO (mg/L)</Label>
              <Input
                id="wm-wt-do"
                type="number"
                step="any"
                min="0"
                value={wtDo}
                onChange={(e) => setWtDo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wm-wt-notes">Notes (optional)</Label>
            <Textarea
              id="wm-wt-notes"
              value={wtNotes}
              onChange={(e) => setWtNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setWtDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={wtPending}>
              {wtPending ? "Saving..." : "Save Water Test"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add / Edit Water Change */}
      <Dialog
        open={wcDialogOpen}
        onOpenChange={setWcDialogOpen}
        title={editingWcId ? "Edit Water Change" : "Log Full / Partial Water Change"}
        description="Log water replaced, optional mineral assay readings, and chemicals added."
      >
        <form onSubmit={handleSaveWaterChange} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="wc-date">Date *</Label>
              <Input
                id="wc-date"
                type="date"
                value={wcDate}
                onChange={(e) => setWcDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="wc-qty">Quantity (L) *</Label>
              <Input
                id="wc-qty"
                type="number"
                step="any"
                min="1"
                value={wcQtyL}
                onChange={(e) => setWcQtyL(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="wc-pct">% Changed *</Label>
              <Input
                id="wc-pct"
                type="number"
                step="any"
                min="1"
                max="100"
                value={wcPct}
                onChange={(e) => setWcPct(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <div className="text-xs font-bold text-slate-800">
              Mineral Readings at Change (optional, mg/L)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label htmlFor="wc-ca">Ca (mg/L)</Label>
                <Input
                  id="wc-ca"
                  type="number"
                  step="any"
                  min="0"
                  value={wcCa}
                  onChange={(e) => setWcCa(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wc-mg">Mg (mg/L)</Label>
                <Input
                  id="wc-mg"
                  type="number"
                  step="any"
                  min="0"
                  value={wcMg}
                  onChange={(e) => setWcMg(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wc-k">K (mg/L)</Label>
                <Input
                  id="wc-k"
                  type="number"
                  step="any"
                  min="0"
                  value={wcK}
                  onChange={(e) => setWcK(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wc-na">Na (mg/L)</Label>
                <Input
                  id="wc-na"
                  type="number"
                  step="any"
                  min="0"
                  value={wcNa}
                  onChange={(e) => setWcNa(e.target.value)}
                />
              </div>
            </div>
            {(liveWcRatios.mgToCa !== null ||
              liveWcRatios.naToK !== null ||
              liveWcRatios.caToK !== null) && (
              <div className="flex flex-wrap gap-2 text-xs text-teal-900 font-semibold">
                {liveWcRatios.mgToCa !== null && (
                  <span>Mg:Ca = {liveWcRatios.mgToCa}:1</span>
                )}
                {liveWcRatios.naToK !== null && (
                  <span>Na:K = {liveWcRatios.naToK}:1</span>
                )}
                {liveWcRatios.caToK !== null && (
                  <span>Ca:K = {liveWcRatios.caToK}:1</span>
                )}
              </div>
            )}
          </div>

          {!editingWcId && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-800">
                  Chemicals Added at Water Change
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setWcChemicals((prev) => [
                      ...prev,
                      {
                        mineralId: firstMineralId,
                        quantityG: "",
                        costAtTime: "",
                        notes: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Chemical
                </Button>
              </div>
              {wcChemicals.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No chemicals attached. Click &ldquo;Add Chemical&rdquo; to include salts added
                  with this change.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {wcChemicals.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end rounded-md bg-slate-50 p-2"
                    >
                      <div className="col-span-5">
                        <Label className="text-[11px]">Mineral</Label>
                        <Select
                          value={row.mineralId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const m = minerals.find((x) => x.id === nextId);
                            const q = Number(row.quantityG);
                            const nextCost =
                              m && Number.isFinite(q) && q > 0
                                ? String(
                                    Math.round((q / 1000) * Number(m.costPerKg) * 100) /
                                      100
                                  )
                                : row.costAtTime;
                            setWcChemicals((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, mineralId: nextId, costAtTime: nextCost }
                                  : item
                              )
                            );
                          }}
                        >
                          {activeMinerals.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({formatChemicalFormula(m.formula)})
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[11px]">Grams (g)</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0.1"
                          placeholder="e.g. 5000"
                          value={row.quantityG}
                          onChange={(e) => {
                            const qtyStr = e.target.value;
                            const m = minerals.find((x) => x.id === row.mineralId);
                            const q = Number(qtyStr);
                            const nextCost =
                              m && Number.isFinite(q) && q >= 0
                                ? String(
                                    Math.round((q / 1000) * Number(m.costPerKg) * 100) /
                                      100
                                  )
                                : row.costAtTime;
                            setWcChemicals((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, quantityG: qtyStr, costAtTime: nextCost }
                                  : item
                              )
                            );
                          }}
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[11px]">Cost (₹)</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={row.costAtTime}
                          onChange={(e) =>
                            setWcChemicals((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, costAtTime: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Remove chemical row"
                          onClick={() =>
                            setWcChemicals((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-700" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="wc-notes">Notes (optional)</Label>
            <Textarea
              id="wc-notes"
              value={wcNotes}
              onChange={(e) => setWcNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setWcDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={wcPending}>
              {wcPending ? "Saving..." : "Save Water Change"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add / Edit Chemical Addition */}
      <Dialog
        open={chemDialogOpen}
        onOpenChange={setChemDialogOpen}
        title={editingChemId ? "Edit Chemical Addition" : "Log Chemical Addition"}
        description="Use the exact hydrate form listed; a different form changes the ion content."
      >
        <form onSubmit={handleSaveChemical} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ma-dt">Date &amp; Time *</Label>
              <Input
                id="ma-dt"
                type="datetime-local"
                value={maDateTime}
                onChange={(e) => setMaDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ma-reason">Reason *</Label>
              <Select
                id="ma-reason"
                value={maReason}
                onChange={(e) =>
                  setMaReason(e.target.value as MineralAdditionItem["reason"])
                }
              >
                <option value="SALINITY_ADJUST">SALINITY_ADJUST</option>
                <option value="PH_ADJUST">PH_ADJUST</option>
                <option value="WATER_CHANGE">WATER_CHANGE</option>
                <option value="TOP_UP">TOP_UP</option>
                <option value="OTHER">OTHER</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ma-mineral">Mineral *</Label>
              <Select
                id="ma-mineral"
                value={maMineralId}
                onChange={(e) => {
                  setMaMineralId(e.target.value);
                  recalcStandaloneCost(e.target.value, maQtyG);
                }}
                required
              >
                {minerals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatChemicalFormula(m.formula)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ma-qty">Quantity (g) *</Label>
              <Input
                id="ma-qty"
                type="number"
                step="any"
                min="0.1"
                value={maQtyG}
                onChange={(e) => {
                  setMaQtyG(e.target.value);
                  recalcStandaloneCost(maMineralId, e.target.value);
                }}
                required
              />
              {Number(maQtyG) >= 1000 && (
                <p className="text-[11px] text-teal-800 mt-0.5">
                  = {formatMineralQuantityG(Number(maQtyG))}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ma-cost">Cost at Time (₹) *</Label>
              <Input
                id="ma-cost"
                type="number"
                step="any"
                min="0"
                value={maCost}
                onChange={(e) => setMaCost(e.target.value)}
                required
              />
            </div>
          </div>

          {standaloneIonsPreview && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-700 mr-1.5">Ions added:</span>
              <IonsLine ions={standaloneIonsPreview} />
            </div>
          )}

          {waterChanges.length > 0 && (
            <div>
              <Label htmlFor="ma-wc">Link to Water Change (optional)</Label>
              <Select
                id="ma-wc"
                value={maWaterChangeId}
                onChange={(e) => setMaWaterChangeId(e.target.value)}
              >
                <option value="">Standalone (not part of a water change)</option>
                {waterChanges.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {formatDateIN(new Date(wc.date))} — {formatNumberIN(wc.quantityLitres, 0)} L (
                    {wc.percentChanged}%)
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="ma-notes">Notes (optional)</Label>
            <Textarea
              id="ma-notes"
              value={maNotes}
              onChange={(e) => setMaNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setChemDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={maPending}>
              {maPending ? "Saving..." : "Save Addition"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: Add / Edit Maintenance Log */}
      <Dialog
        open={maintDialogOpen}
        onOpenChange={setMaintDialogOpen}
        title={editingMaintId ? "Edit Maintenance Log" : "Log RAS Maintenance"}
      >
        <form onSubmit={handleSaveMaintenance} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sl-date">Date *</Label>
              <Input
                id="sl-date"
                type="date"
                value={slDate}
                onChange={(e) => setSlDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sl-type">Event Type *</Label>
              <Select
                id="sl-type"
                value={slType}
                onChange={(e) => setSlType(e.target.value as SystemLogItem["type"])}
              >
                {Object.entries(SYSTEM_LOG_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sl-qty">Water Quantity (L, optional)</Label>
              <Input
                id="sl-qty"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 150"
                value={slQtyL}
                onChange={(e) => setSlQtyL(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sl-cost">Cost (₹, optional)</Label>
              <Input
                id="sl-cost"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 500"
                value={slCost}
                onChange={(e) => setSlCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sl-notes">Notes (optional)</Label>
            <Textarea
              id="sl-notes"
              value={slNotes}
              onChange={(e) => setSlNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMaintDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={slPending}>
              {slPending ? "Saving..." : "Save Maintenance Log"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget?.title ?? "Delete"}
        description={deleteTarget?.description ?? ""}
        pending={deletePending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
