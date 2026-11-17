"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Shell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBatchAction } from "@/app/actions/crabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { previewBatchCodes } from "@/lib/batch";
import { formatINR } from "@/lib/format";

interface EmptyTrayOption {
  id: string;
  number: string;
  isTreatmentTray: boolean;
}

interface CrabDraftRow {
  key: string;
  trayId: string;
  sex: "MALE" | "FEMALE";
  initialWeightG: string;
  purchaseCost: string;
  costEditedManually: boolean;
  notes: string;
}

export function BatchWizard({
  nextLetter,
  suppliers,
  emptyTrays,
  defaultPurchaseDate,
  defaultExpectedHarvest,
  preselectedTrayId,
}: {
  nextLetter: string;
  suppliers: Array<{ id: string; name: string }>;
  emptyTrays: EmptyTrayOption[];
  defaultPurchaseDate: string;
  defaultExpectedHarvest: string;
  preselectedTrayId?: string;
}) {
  const router = useRouter();
  const preferredInitialTray =
    emptyTrays.find((t) => t.id === preselectedTrayId) ??
    emptyTrays.find((t) => !t.isTreatmentTray) ??
    emptyTrays[0];

  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? "");
  const [purchaseDate, setPurchaseDate] = React.useState(defaultPurchaseDate);
  const [pricePerKg, setPricePerKg] = React.useState("");
  const [expectedHarvestDate, setExpectedHarvestDate] = React.useState(
    defaultExpectedHarvest
  );
  const [notes, setNotes] = React.useState("");
  const [rows, setRows] = React.useState<CrabDraftRow[]>(() =>
    preferredInitialTray
      ? [
          {
            key: "row-1",
            trayId: preferredInitialTray.id,
            sex: "MALE",
            initialWeightG: "",
            purchaseCost: "",
            costEditedManually: false,
            notes: "",
          },
        ]
      : []
  );
  const [submitting, setSubmitting] = React.useState(false);

  const codesPreview = previewBatchCodes(nextLetter, 1, rows.length);

  const recalcRowCost = (weightStr: string, priceKgStr: string): string => {
    const w = Number(weightStr);
    const p = Number(priceKgStr);
    if (
      priceKgStr.trim() !== "" &&
      Number.isFinite(w) &&
      Number.isFinite(p) &&
      w > 0 &&
      p >= 0
    ) {
      return String(Math.round((w / 1000) * p * 100) / 100);
    }
    return "";
  };

  const handleBatchPriceChange = (newPrice: string) => {
    setPricePerKg(newPrice);
    setRows((prev) =>
      prev.map((row) => {
        if (row.costEditedManually) return row;
        const computed = recalcRowCost(row.initialWeightG, newPrice);
        return computed ? { ...row, purchaseCost: computed } : row;
      })
    );
  };

  const addCrabRow = () => {
    const usedIds = new Set(rows.map((r) => r.trayId));
    const available = emptyTrays.filter((t) => !usedIds.has(t.id));
    const nextTray = available.find((t) => !t.isTreatmentTray) ?? available[0];
    if (!nextTray) {
      toast.error("All empty trays are already assigned in this form.");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${prev.length + 1}`,
        trayId: nextTray.id,
        sex: "MALE",
        initialWeightG: "",
        purchaseCost: "",
        costEditedManually: false,
        notes: "",
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<CrabDraftRow>) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        if (patch.initialWeightG !== undefined && !next.costEditedManually) {
          const computed = recalcRowCost(patch.initialWeightG, pricePerKg);
          if (computed) next.purchaseCost = computed;
        }
        return next;
      })
    );
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await createBatchAction({
      supplierId,
      purchaseDate,
      pricePerKg: pricePerKg.trim() === "" ? null : Number(pricePerKg),
      expectedHarvestDate: expectedHarvestDate.trim() || null,
      notes,
      crabs: rows.map((r) => ({
        trayId: r.trayId,
        sex: r.sex,
        initialWeightG: Number(r.initialWeightG),
        purchaseCost: Number(r.purchaseCost || 0),
        notes: r.notes,
      })),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Batch ${res.data?.letter} stocked (${res.data?.codes.join(", ")})`
    );
    router.push("/crabs");
    router.refresh();
  };

  const totalCost = rows.reduce(
    (sum, r) => sum + (Number(r.purchaseCost) || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Stock New Batch
          </h1>
          <p className="text-sm text-slate-600">
            Creates immutable crab codes and places each crab into an empty active tray.
          </p>
        </div>
        <Badge variant="teal" className="text-sm px-3 py-1.5 self-start">
          Next Batch: {nextLetter}
          {codesPreview.length > 0 ? ` → ${codesPreview.join(", ")}` : ""}
        </Badge>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              Add an active supplier before stocking a batch.
            </p>
            <Link
              href="/contacts"
              className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white"
            >
              Go to Suppliers &amp; Buyers
            </Link>
          </CardContent>
        </Card>
      ) : emptyTrays.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              All active trays are currently occupied. Free or add a tray first.
            </p>
            <Link
              href="/trays"
              className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white"
            >
              Manage Trays
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch {nextLetter} Details</CardTitle>
              <CardDescription>
                Optional batch price/kg auto-fills each crab&apos;s purchase cost when weight is entered.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="b-supplier">Supplier *</Label>
                <Select
                  id="b-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="b-date">Purchase / Stocked Date *</Label>
                <Input
                  id="b-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="b-price">Batch Price/kg (₹, optional)</Label>
                <Input
                  id="b-price"
                  type="number"
                  step="any"
                  min="0"
                  value={pricePerKg}
                  onChange={(e) => handleBatchPriceChange(e.target.value)}
                  placeholder="e.g. 900"
                />
              </div>
              <div>
                <Label htmlFor="b-harvest">Expected Harvest Date</Label>
                <Input
                  id="b-harvest"
                  type="date"
                  value={expectedHarvestDate}
                  onChange={(e) => setExpectedHarvestDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Label htmlFor="b-notes">Batch Notes (optional)</Label>
                <Textarea
                  id="b-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Transport condition, moult state on arrival..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>
                  Crabs ({rows.length}) • Total Purchase {formatINR(totalCost)}
                </CardTitle>
                <CardDescription>
                  {emptyTrays.length} empty active tray{emptyTrays.length === 1 ? "" : "s"} available
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addCrabRow}
                disabled={rows.length >= emptyTrays.length}
              >
                <Plus className="h-4 w-4" />
                Add Crab Row
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row, idx) => {
                const code = `${nextLetter.toLowerCase()}${idx + 1}`;
                const usedByOthers = new Set(
                  rows.filter((_, i) => i !== idx).map((r) => r.trayId)
                );
                const trayChoices = emptyTrays.filter(
                  (t) => !usedByOthers.has(t.id)
                );

                return (
                  <div
                    key={row.key}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="teal" className="font-mono text-sm">
                        Crab {code}
                      </Badge>
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          onClick={() => removeRow(idx)}
                          aria-label={`Remove crab ${code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <div>
                        <Label htmlFor={`row-tray-${idx}`}>Empty Tray *</Label>
                        <Select
                          id={`row-tray-${idx}`}
                          value={row.trayId}
                          onChange={(e) => updateRow(idx, { trayId: e.target.value })}
                          required
                        >
                          {trayChoices.map((t) => (
                            <option key={t.id} value={t.id}>
                              Tray {t.number}
                              {t.isTreatmentTray ? " (Treatment)" : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`row-sex-${idx}`}>Sex</Label>
                        <Select
                          id={`row-sex-${idx}`}
                          value={row.sex}
                          onChange={(e) =>
                            updateRow(idx, {
                              sex: e.target.value as "MALE" | "FEMALE",
                            })
                          }
                        >
                          <option value="MALE">MALE</option>
                          <option value="FEMALE">FEMALE</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`row-wt-${idx}`}>Initial Wt (g) *</Label>
                        <Input
                          id={`row-wt-${idx}`}
                          type="number"
                          step="any"
                          min="1"
                          value={row.initialWeightG}
                          onChange={(e) =>
                            updateRow(idx, { initialWeightG: e.target.value })
                          }
                          placeholder="e.g. 380"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`row-cost-${idx}`}>Purchase Cost (₹) *</Label>
                        <Input
                          id={`row-cost-${idx}`}
                          type="number"
                          step="any"
                          min="0"
                          value={row.purchaseCost}
                          onChange={(e) =>
                            updateRow(idx, {
                              purchaseCost: e.target.value,
                              costEditedManually: true,
                            })
                          }
                          placeholder="e.g. 342"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`row-notes-${idx}`}>Notes</Label>
                        <Input
                          id={`row-notes-${idx}`}
                          value={row.notes}
                          onChange={(e) => updateRow(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Link
                  href="/crabs"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </Link>
                <Button type="submit" disabled={submitting || rows.length === 0}>
                  <Shell className="h-4 w-4" />
                  {submitting
                    ? "Creating Batch..."
                    : `Create Batch ${nextLetter} (${rows.length} crab${rows.length === 1 ? "" : "s"})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

