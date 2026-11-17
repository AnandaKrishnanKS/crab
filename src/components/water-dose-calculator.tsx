"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calculator, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addMineralAdditionsBatchAction } from "@/app/actions/water";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  formatChemicalFormula,
  formatINR,
  formatMineralQuantityG,
  formatNumberIN,
} from "@/lib/format";
import { calculateChemicalDoses, type MineralDefinition } from "@/lib/water";

export interface WaterMineralItem extends MineralDefinition {
  stockKg: number | null;
  active: boolean;
}

interface ReviewAdditionRow {
  mineralId: string;
  name: string;
  formula: string;
  quantityG: string;
  costAtTime: string;
  reason: "SALINITY_ADJUST" | "PH_ADJUST" | "WATER_CHANGE" | "TOP_UP" | "OTHER";
  notes: string;
}

export function WaterDoseCalculator({
  minerals,
  defaultVolumeLitres,
  defaultDateTimeLocal,
  latestSalinityPpt,
  latestAlkMgL,
  latestCaMgL,
  latestMgMgL,
  latestKMgL,
}: {
  minerals: WaterMineralItem[];
  defaultVolumeLitres: number;
  defaultDateTimeLocal: string;
  latestSalinityPpt: number | null;
  latestAlkMgL: number | null;
  latestCaMgL: number | null;
  latestMgMgL: number | null;
  latestKMgL: number | null;
}) {
  const router = useRouter();
  const [volumeL, setVolumeL] = React.useState(String(defaultVolumeLitres));

  const [curSal, setCurSal] = React.useState(
    latestSalinityPpt !== null ? String(latestSalinityPpt) : ""
  );
  const [tgtSal, setTgtSal] = React.useState("");

  const [curCa, setCurCa] = React.useState(
    latestCaMgL !== null ? String(latestCaMgL) : ""
  );
  const [tgtCa, setTgtCa] = React.useState("");

  const [curMg, setCurMg] = React.useState(
    latestMgMgL !== null ? String(latestMgMgL) : ""
  );
  const [tgtMg, setTgtMg] = React.useState("");
  const [mgCl2Share, setMgCl2Share] = React.useState("50");

  const [curK, setCurK] = React.useState(
    latestKMgL !== null ? String(latestKMgL) : ""
  );
  const [tgtK, setTgtK] = React.useState("");

  const [alkMode, setAlkMode] = React.useState<"CACO3" | "HCO3">("CACO3");
  const [curAlk, setCurAlk] = React.useState(
    latestAlkMgL !== null ? String(latestAlkMgL) : ""
  );
  const [tgtAlk, setTgtAlk] = React.useState("");

  const activeMinerals = minerals.filter((m) => m.active);
  const toOptNum = (v: string) => {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const result = calculateChemicalDoses(
    {
      systemVolumeLitres: Number(volumeL) || 0,
      currentSalinityPpt: toOptNum(curSal),
      targetSalinityPpt: toOptNum(tgtSal),
      currentCaMgL: toOptNum(curCa),
      targetCaMgL: toOptNum(tgtCa),
      currentMgMgL: toOptNum(curMg),
      targetMgMgL: toOptNum(tgtMg),
      mgCl2SharePercent: Number(mgCl2Share) || 50,
      currentKMgL: toOptNum(curK),
      targetKMgL: toOptNum(tgtK),
      alkalinityMode: alkMode,
      currentAlkalinity: toOptNum(curAlk),
      targetAlkalinity: toOptNum(tgtAlk),
    },
    activeMinerals
  );

  // Editable "Log this addition" modal
  const [logOpen, setLogOpen] = React.useState(false);
  const [logDateTime, setLogDateTime] = React.useState(defaultDateTimeLocal);
  const [reviewRows, setReviewRows] = React.useState<ReviewAdditionRow[]>([]);
  const [logPending, setLogPending] = React.useState(false);

  const openLogModal = () => {
    setLogDateTime(defaultDateTimeLocal);
    setReviewRows(
      result.items.map((item) => ({
        mineralId: item.mineralId,
        name: item.name,
        formula: item.formula,
        quantityG: String(item.grams),
        costAtTime: String(item.estimatedCost),
        reason:
          item.reason === "MINERAL_BALANCE" ? "TOP_UP" : item.reason,
        notes: item.note,
      }))
    );
    setLogOpen(true);
  };

  const handleSaveBatchAddition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewRows.length === 0) {
      toast.error("Keep at least one chemical row.");
      return;
    }
    setLogPending(true);
    const res = await addMineralAdditionsBatchAction({
      dateTime: logDateTime,
      items: reviewRows.map((r) => ({
        mineralId: r.mineralId,
        quantityG: Number(r.quantityG),
        costAtTime: r.costAtTime,
        reason: r.reason,
        notes: r.notes,
      })),
    });
    setLogPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Dose additions logged.");
    setLogOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">
            Use the exact hydrate form listed; a different form changes the ion content.
          </p>
          <p>
            Dose large salt/bicarbonate adjustments gradually across circulation passes and verify
            salinity (ppt) and pH before putting crabs back in.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-teal-700" />
              System &amp; Target Parameters
            </CardTitle>
            <CardDescription>
              Fill any parameters you want to raise; decrease fields stay at 0 g.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dc-vol">RAS Volume (L) *</Label>
              <Input
                id="dc-vol"
                type="number"
                step="any"
                min="1"
                value={volumeL}
                onChange={(e) => setVolumeL(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <Label htmlFor="dc-sal-cur">Current Salinity (ppt)</Label>
                <Input
                  id="dc-sal-cur"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 17"
                  value={curSal}
                  onChange={(e) => setCurSal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dc-sal-tgt">Target Salinity (ppt)</Label>
                <Input
                  id="dc-sal-tgt"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 20"
                  value={tgtSal}
                  onChange={(e) => setTgtSal(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <Label htmlFor="dc-ca-cur">Current Ca (mg/L)</Label>
                <Input
                  id="dc-ca-cur"
                  type="number"
                  step="any"
                  min="0"
                  value={curCa}
                  onChange={(e) => setCurCa(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dc-ca-tgt">Target Ca (mg/L)</Label>
                <Input
                  id="dc-ca-tgt"
                  type="number"
                  step="any"
                  min="0"
                  value={tgtCa}
                  onChange={(e) => setTgtCa(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="dc-mg-cur">Current Mg (mg/L)</Label>
                  <Input
                    id="dc-mg-cur"
                    type="number"
                    step="any"
                    min="0"
                    value={curMg}
                    onChange={(e) => setCurMg(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc-mg-tgt">Target Mg (mg/L)</Label>
                  <Input
                    id="dc-mg-tgt"
                    type="number"
                    step="any"
                    min="0"
                    value={tgtMg}
                    onChange={(e) => setTgtMg(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc-mg-split">MgCl₂ Share (%)</Label>
                  <Input
                    id="dc-mg-split"
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={mgCl2Share}
                    onChange={(e) => setMgCl2Share(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Remaining {Math.max(0, 100 - (Number(mgCl2Share) || 50))}% comes from{" "}
                {formatChemicalFormula("MgSO4.7H2O")}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <Label htmlFor="dc-k-cur">Current K (mg/L)</Label>
                <Input
                  id="dc-k-cur"
                  type="number"
                  step="any"
                  min="0"
                  value={curK}
                  onChange={(e) => setCurK(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dc-k-tgt">Target K (mg/L)</Label>
                <Input
                  id="dc-k-tgt"
                  type="number"
                  step="any"
                  min="0"
                  value={tgtK}
                  onChange={(e) => setTgtK(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div>
                <Label htmlFor="dc-alk-mode">Alkalinity / Bicarbonate Unit</Label>
                <Select
                  id="dc-alk-mode"
                  value={alkMode}
                  onChange={(e) => setAlkMode(e.target.value as "CACO3" | "HCO3")}
                >
                  <option value="CACO3">Alkalinity (mg/L as CaCO₃)</option>
                  <option value="HCO3">Bicarbonate (mg/L as HCO₃⁻)</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dc-alk-cur">
                    Current ({alkMode === "CACO3" ? "mg/L CaCO₃" : "mg/L HCO₃⁻"})
                  </Label>
                  <Input
                    id="dc-alk-cur"
                    type="number"
                    step="any"
                    min="0"
                    value={curAlk}
                    onChange={(e) => setCurAlk(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dc-alk-tgt">
                    Target ({alkMode === "CACO3" ? "mg/L CaCO₃" : "mg/L HCO₃⁻"})
                  </Label>
                  <Input
                    id="dc-alk-tgt"
                    type="number"
                    step="any"
                    min="0"
                    value={tgtAlk}
                    onChange={(e) => setTgtAlk(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended Chemical Doses</CardTitle>
            <CardDescription>
              Computed from active Settings ion fractions and current costs (₹/kg).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                Enter any target value higher than the current value on the left to calculate exact
                gram doses and ₹ costs.
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {result.items.map((item) => (
                    <div
                      key={`${item.mineralId}-${item.reason}`}
                      className="p-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <Badge variant="default">
                            {formatChemicalFormula(item.formula)}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{item.note}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-teal-900">
                          {formatMineralQuantityG(item.grams)}
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {formatINR(item.estimatedCost)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {result.mineralSalinityPptContribution > 0 && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                    Mineral-balance / buffer additions also add approximately{" "}
                    <span className="font-bold">
                      +{formatNumberIN(result.mineralSalinityPptContribution, 2)} ppt
                    </span>{" "}
                    dissolved salts to the RAS.
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700">Total Estimated Cost</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {formatINR(result.totalEstimatedCost)}
                  </span>
                </div>

                <Button type="button" onClick={openLogModal} className="w-full">
                  <Plus className="h-4 w-4" />
                  Log this addition ({result.items.length} chemical
                  {result.items.length === 1 ? "" : "s"})
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review & Edit calculated doses before logging */}
      <Dialog
        open={logOpen}
        onOpenChange={setLogOpen}
        title="Review & Log Calculated Doses"
        description="Adjust weighed grams or actual ₹ cost if needed before saving."
      >
        <form onSubmit={handleSaveBatchAddition} className="space-y-4">
          <div>
            <Label htmlFor="dc-log-dt">Date &amp; Time *</Label>
            <Input
              id="dc-log-dt"
              type="datetime-local"
              value={logDateTime}
              onChange={(e) => setLogDateTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {reviewRows.map((row, idx) => (
              <div
                key={`${row.mineralId}-${idx}`}
                className="rounded-lg border border-slate-200 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    {row.name} ({formatChemicalFormula(row.formula)})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${row.name}`}
                    onClick={() =>
                      setReviewRows((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-700" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Grams (g)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.1"
                      value={row.quantityG}
                      onChange={(e) => {
                        const qtyStr = e.target.value;
                        const min = activeMinerals.find((m) => m.id === row.mineralId);
                        const qty = Number(qtyStr);
                        const autoCost =
                          min && Number.isFinite(qty) && qty >= 0
                            ? String(
                                Math.round(
                                  (qty / 1000) * Number(min.costPerKg) * 100
                                ) / 100
                              )
                            : row.costAtTime;
                        setReviewRows((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, quantityG: qtyStr, costAtTime: autoCost }
                              : item
                          )
                        );
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label>Cost (₹)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={row.costAtTime}
                      onChange={(e) =>
                        setReviewRows((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, costAtTime: e.target.value } : item
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Select
                      value={row.reason}
                      onChange={(e) =>
                        setReviewRows((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  reason: e.target.value as ReviewAdditionRow["reason"],
                                }
                              : item
                          )
                        )
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
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={logPending || reviewRows.length === 0}>
              {logPending ? "Saving..." : "Confirm & Log Addition"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

