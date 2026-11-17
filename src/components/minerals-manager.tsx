"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Edit3, FlaskConical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteMineralAction,
  toggleMineralActiveAction,
  upsertMineralAction,
} from "@/app/actions/master-data";
import { SafeDeleteDialog } from "@/components/safe-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatChemicalFormula,
  formatINR,
  formatNumberIN,
} from "@/lib/format";

export interface MineralRow {
  id: string;
  name: string;
  formula: string;
  purpose: "SALINITY" | "MINERAL_BALANCE" | "PH_BUFFER";
  costPerKg: number;
  stockKg: number | null;
  active: boolean;
  notes: string | null;
  naFraction: number;
  mgFraction: number;
  caFraction: number;
  kFraction: number;
  clFraction: number;
  so4Fraction: number;
  hco3Fraction: number;
  additionCount: number;
}

const PURPOSE_LABELS: Record<MineralRow["purpose"], string> = {
  SALINITY: "Salinity",
  MINERAL_BALANCE: "Mineral balance",
  PH_BUFFER: "pH / Alkalinity buffer",
};

const ION_FIELDS = [
  { key: "naFraction", label: "Na fraction", short: "Na" },
  { key: "mgFraction", label: "Mg fraction", short: "Mg" },
  { key: "caFraction", label: "Ca fraction", short: "Ca" },
  { key: "kFraction", label: "K fraction", short: "K" },
  { key: "clFraction", label: "Cl fraction", short: "Cl" },
  { key: "so4Fraction", label: "SO₄ fraction", short: "SO₄" },
  { key: "hco3Fraction", label: "HCO₃ fraction", short: "HCO₃" },
] as const;

export function MineralsManager({
  minerals,
  lowMineralStockKg,
}: {
  minerals: MineralRow[];
  lowMineralStockKg: number;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MineralRow | null>(null);
  const [name, setName] = React.useState("");
  const [formula, setFormula] = React.useState("");
  const [purpose, setPurpose] =
    React.useState<MineralRow["purpose"]>("MINERAL_BALANCE");
  const [costPerKg, setCostPerKg] = React.useState("");
  const [stockKg, setStockKg] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [fractions, setFractions] = React.useState<Record<string, string>>({
    naFraction: "0",
    mgFraction: "0",
    caFraction: "0",
    kFraction: "0",
    clFraction: "0",
    so4Fraction: "0",
    hco3Fraction: "0",
  });
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<MineralRow | null>(null);
  const [blockedMsg, setBlockedMsg] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setFormula("");
    setPurpose("MINERAL_BALANCE");
    setCostPerKg("");
    setStockKg("");
    setActive(true);
    setNotes("");
    setFractions({
      naFraction: "0",
      mgFraction: "0",
      caFraction: "0",
      kFraction: "0",
      clFraction: "0",
      so4Fraction: "0",
      hco3Fraction: "0",
    });
    setFormOpen(true);
  };

  const openEdit = (m: MineralRow) => {
    setEditing(m);
    setName(m.name);
    setFormula(m.formula);
    setPurpose(m.purpose);
    setCostPerKg(String(m.costPerKg));
    setStockKg(m.stockKg !== null ? String(m.stockKg) : "");
    setActive(m.active);
    setNotes(m.notes ?? "");
    setFractions({
      naFraction: String(m.naFraction),
      mgFraction: String(m.mgFraction),
      caFraction: String(m.caFraction),
      kFraction: String(m.kFraction),
      clFraction: String(m.clFraction),
      so4Fraction: String(m.so4Fraction),
      hco3Fraction: String(m.hco3Fraction),
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await upsertMineralAction({
      id: editing?.id,
      name,
      formula,
      purpose,
      costPerKg: Number(costPerKg),
      stockKg: stockKg.trim() === "" ? null : Number(stockKg),
      active,
      notes,
      naFraction: Number(fractions.naFraction || 0),
      mgFraction: Number(fractions.mgFraction || 0),
      caFraction: Number(fractions.caFraction || 0),
      kFraction: Number(fractions.kFraction || 0),
      clFraction: Number(fractions.clFraction || 0),
      so4Fraction: Number(fractions.so4Fraction || 0),
      hco3Fraction: Number(fractions.hco3Fraction || 0),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Chemical updated" : "Chemical added");
    setFormOpen(false);
    router.refresh();
  };

  const handleToggleActive = async (m: MineralRow) => {
    const res = await toggleMineralActiveAction(m.id, !m.active);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${m.name} ${m.active ? "deactivated" : "activated"}`);
    router.refresh();
  };

  const openDelete = (m: MineralRow) => {
    setDeleteTarget(m);
    setBlockedMsg(
      m.additionCount > 0
        ? `${m.name} has ${m.additionCount} addition log${m.additionCount === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`
        : null
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res = await deleteMineralAction(deleteTarget.id);
    setDeletePending(false);
    if (!res.ok) {
      if (res.blockedByHistory) {
        setBlockedMsg(res.error);
      } else {
        toast.error(res.error);
      }
      return;
    }
    toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleDeactivateFromDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res = await toggleMineralActiveAction(deleteTarget.id, false);
    setDeletePending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${deleteTarget.name} deactivated`);
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            RAS Minerals &amp; Water Chemicals
          </h2>
          <p className="text-xs text-slate-600">
            Ion fractions drive the Water Dose Calculator and added ion tracking.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Mineral
        </Button>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 flex items-start gap-2.5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
        <p className="font-semibold">
          Use the exact hydrate form listed; a different form changes the ion content.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {minerals.map((m) => {
          const isLowStock =
            m.active && m.stockKg !== null && m.stockKg <= lowMineralStockKg;
          const nonZeroIons = ION_FIELDS.filter((f) => m[f.key] > 0).map(
            (f) => `${f.short} ${m[f.key].toFixed(3)}`
          );

          return (
            <Card
              key={m.id}
              className={!m.active ? "bg-slate-100/80 opacity-85" : undefined}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{m.name}</h3>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                        {formatChemicalFormula(m.formula)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="teal">{PURPOSE_LABELS[m.purpose]}</Badge>
                      {!m.active && <Badge variant="default">Inactive</Badge>}
                      {isLowStock && (
                        <Badge variant="danger">
                          Low stock ({formatNumberIN(m.stockKg ?? 0, 2)} kg)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold text-slate-900">
                      {formatINR(m.costPerKg)}/kg
                    </div>
                    <div className="text-slate-600">
                      Stock:{" "}
                      {m.stockKg !== null
                        ? `${formatNumberIN(m.stockKg, 2)} kg`
                        : "Not tracked"}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Ion fractions: </span>
                  {nonZeroIons.length > 0 ? nonZeroIons.join(" • ") : "None set"}
                </div>

                {m.notes && <p className="text-xs text-slate-600">{m.notes}</p>}

                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(m)}
                  >
                    {m.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => openDelete(m)}
                    aria-label={`Delete mineral ${m.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Edit ${editing.name}` : "Add Chemical / Mineral"}
        description="Store chemical cost, stock kg, and mass ion fractions."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-950">
            Use the exact hydrate form listed; a different form changes the ion content.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="min-name">Chemical Name *</Label>
              <Input
                id="min-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Magnesium chloride"
                required
              />
            </div>
            <div>
              <Label htmlFor="min-formula">
                Formula *{" "}
                {formula.trim() && (
                  <span className="font-mono text-xs text-teal-800 ml-1">
                    ({formatChemicalFormula(formula)})
                  </span>
                )}
              </Label>
              <Input
                id="min-formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g. MgCl2.6H2O"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="min-purpose">Purpose</Label>
              <Select
                id="min-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as MineralRow["purpose"])}
              >
                <option value="SALINITY">Salinity</option>
                <option value="MINERAL_BALANCE">Mineral balance</option>
                <option value="PH_BUFFER">pH buffer</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="min-cost">Cost per kg (₹) *</Label>
              <Input
                id="min-cost"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={costPerKg}
                onChange={(e) => setCostPerKg(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="min-stock">Stock (kg, optional)</Label>
              <Input
                id="min-stock"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={stockKg}
                onChange={(e) => setStockKg(e.target.value)}
                placeholder="Blank = not tracked"
              />
            </div>
          </div>

          <div>
            <Label>Ion Mass Fractions (0 to 1, e.g. 0.120 for 12%)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
              {ION_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`min-${field.key}`} className="text-xs font-medium text-slate-600">
                    {field.label}
                  </Label>
                  <Input
                    id={`min-${field.key}`}
                    type="number"
                    step="any"
                    min="0"
                    max="1"
                    inputMode="decimal"
                    value={fractions[field.key]}
                    onChange={(e) =>
                      setFractions((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5 accent-teal-700"
            />
            <span className="text-sm font-semibold text-slate-900">Active</span>
          </label>

          <div>
            <Label htmlFor="min-notes">Notes (optional)</Label>
            <Textarea
              id="min-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Grade, supplier brand, dissolving tips..."
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
              <FlaskConical className="h-4 w-4" />
              {submitting ? "Saving..." : editing ? "Save Chemical" : "Create Chemical"}
            </Button>
          </div>
        </form>
      </Dialog>

      <SafeDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        entityLabel="chemical"
        itemName={deleteTarget?.name ?? ""}
        blockedMessage={blockedMsg}
        canDeactivate={Boolean(deleteTarget?.active)}
        pending={deletePending}
        onDelete={handleConfirmDelete}
        onDeactivate={handleDeactivateFromDelete}
      />
    </div>
  );
}

