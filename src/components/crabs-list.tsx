"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Shell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addCrabToBatchAction } from "@/app/actions/crabs";
import { deleteBatchAction } from "@/app/actions/logs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TypedConfirmDeleteDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCrabCode } from "@/lib/batch";
import { formatINR, formatNumberIN } from "@/lib/format";

export interface CrabListItem {
  id: string;
  code: string;
  batchLetter: string;
  sex: "MALE" | "FEMALE";
  status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  trayId: string | null;
  trayNumber: string | null;
  daysInSystem: number;
  initialWeightG: number;
  latestWeightG: number;
  weightGainG: number;
  profit: number | null;
}

export interface BatchOption {
  id: string;
  letter: string;
  nextCrabSeq: number;
  supplierName: string;
  purchaseDateLabel: string;
  pricePerKg: number | null;
  crabCount: number;
  openCrabCount: number;
  logCount: number;
}

export function CrabsList({
  crabs,
  batches,
  emptyTrays,
  defaultDateYmd,
  defaultExpectedHarvest,
  initialBatchFilter = "ALL",
  initialTab = "crabs",
}: {
  crabs: CrabListItem[];
  batches: BatchOption[];
  emptyTrays: Array<{ id: string; number: string; isTreatmentTray: boolean }>;
  defaultDateYmd: string;
  defaultExpectedHarvest: string;
  initialBatchFilter?: string;
  initialTab?: "crabs" | "batches";
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"crabs" | "batches">(initialTab);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [batchFilter, setBatchFilter] = React.useState<string>(initialBatchFilter);

  const [deletingBatch, setDeletingBatch] = React.useState<BatchOption | null>(null);
  const [batchDeletePending, setBatchDeletePending] = React.useState(false);

  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedBatchId, setSelectedBatchId] = React.useState(batches[0]?.id ?? "");
  const [trayId, setTrayId] = React.useState(
    (emptyTrays.find((t) => !t.isTreatmentTray) ?? emptyTrays[0])?.id ?? ""
  );
  const [sex, setSex] = React.useState<"MALE" | "FEMALE">("MALE");
  const [initialWeightG, setInitialWeightG] = React.useState("");
  const [purchaseCost, setPurchaseCost] = React.useState("");
  const [stockedDate, setStockedDate] = React.useState(defaultDateYmd);
  const [expectedHarvestDate, setExpectedHarvestDate] = React.useState(
    defaultExpectedHarvest
  );
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const nextCodePreview = selectedBatch
    ? formatCrabCode(selectedBatch.letter, selectedBatch.nextCrabSeq)
    : "";

  const filtered = crabs.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (batchFilter !== "ALL" && c.batchLetter !== batchFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchCode = c.code.toLowerCase().includes(q);
      const matchTray = c.trayNumber?.toLowerCase().includes(q);
      if (!matchCode && !matchTray) return false;
    }
    return true;
  });

  const handleAddToBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await addCrabToBatchAction({
      batchId: selectedBatchId,
      trayId,
      sex,
      initialWeightG: Number(initialWeightG),
      purchaseCost: Number(purchaseCost || 0),
      stockedDate,
      expectedHarvestDate: expectedHarvestDate || null,
      notes,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Crab ${res.data?.code} added to batch ${selectedBatch?.letter}`);
    setAddOpen(false);
    setInitialWeightG("");
    setPurchaseCost("");
    setNotes("");
    router.refresh();
  };

  const handleConfirmDeleteBatch = async () => {
    if (!deletingBatch) return;
    setBatchDeletePending(true);
    const res = await deleteBatchAction({
      batchId: deletingBatch.id,
      confirmLetter: deletingBatch.letter,
    });
    setBatchDeletePending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? `Batch ${deletingBatch.letter} deleted.`);
    setDeletingBatch(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Crabs</h1>
          <p className="text-sm text-slate-600">
            Track individual crabs across batches, trays, growth, health, and profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {batches.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setAddOpen(true)}
              disabled={emptyTrays.length === 0}
            >
              <Plus className="h-4 w-4" />
              Add Crab to Batch
            </Button>
          )}
          <Link
            href="/batches/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            New Batch
          </Link>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v)}
        options={[
          { id: "crabs" as const, label: "Crabs", count: crabs.length },
          { id: "batches" as const, label: "Batches", count: batches.length },
        ]}
      />

      {activeTab === "crabs" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search crab code (e.g. b1) or tray"
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses ({crabs.length})</option>
              <option value="ACTIVE">
                ACTIVE ({crabs.filter((c) => c.status === "ACTIVE").length})
              </option>
              <option value="SICK">
                SICK ({crabs.filter((c) => c.status === "SICK").length})
              </option>
              <option value="SOLD">
                SOLD ({crabs.filter((c) => c.status === "SOLD").length})
              </option>
              <option value="DEAD">
                DEAD ({crabs.filter((c) => c.status === "DEAD").length})
              </option>
            </Select>
            <Select
              aria-label="Filter by batch"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="ALL">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.letter}>
                  Batch {b.letter} ({b.supplierName})
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            No crabs match your current filter.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filtered.map((c) => (
              <Link key={c.id} href={`/crabs/${c.id}`}>
                <Card className="hover:border-teal-400 transition-colors">
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold text-teal-900">
                          {c.code}
                        </span>
                        <Badge
                          variant={
                            c.status === "SICK"
                              ? "danger"
                              : c.status === "ACTIVE"
                              ? "teal"
                              : c.status === "SOLD"
                              ? "success"
                              : "default"
                          }
                        >
                          {c.status}
                        </Badge>
                        {c.trayNumber && (
                          <span className="text-xs font-semibold text-slate-600">
                            Tray {c.trayNumber}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Batch {c.batchLetter} • {c.daysInSystem} d •{" "}
                        {formatNumberIN(c.latestWeightG, 0)} g (
                        {c.weightGainG >= 0 ? "+" : ""}
                        {formatNumberIN(c.weightGainG, 0)} g)
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {c.profit !== null ? (
                        <span
                          className={`text-sm font-bold ${
                            c.profit >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {formatINR(c.profit)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Open</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Tray</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Days</th>
                    <th className="px-4 py-3 font-semibold text-right">Weight</th>
                    <th className="px-4 py-3 font-semibold text-right">Gain</th>
                    <th className="px-4 py-3 font-semibold text-right">Profit / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono font-bold">
                        <Link
                          href={`/crabs/${c.id}`}
                          className="text-teal-800 underline underline-offset-2"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {c.batchLetter}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.trayId && c.trayNumber ? (
                          <Link
                            href={`/trays/${c.trayId}`}
                            className="font-semibold text-slate-800 hover:text-teal-800 underline underline-offset-2"
                          >
                            Tray {c.trayNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={
                            c.status === "SICK"
                              ? "danger"
                              : c.status === "ACTIVE"
                              ? "teal"
                              : c.status === "SOLD"
                              ? "success"
                              : "default"
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {c.daysInSystem} d
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatNumberIN(c.latestWeightG, 0)} g
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {c.weightGainG >= 0 ? "+" : ""}
                        {formatNumberIN(c.weightGainG, 0)} g
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">
                        {c.profit !== null ? (
                          <span
                            className={
                              c.profit >= 0 ? "text-emerald-700" : "text-red-700"
                            }
                          >
                            {formatINR(c.profit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
        </>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            No batches recorded yet. Create your first batch to start stocking crabs.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-extrabold text-teal-900">
                      Batch {b.letter}
                    </span>
                    <Badge variant={b.openCrabCount > 0 ? "teal" : "default"}>
                      {b.openCrabCount} active/sick • {b.crabCount} total
                    </Badge>
                    {b.pricePerKg !== null && (
                      <span className="text-xs font-medium text-slate-600">
                        {formatINR(b.pricePerKg)}/kg
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    Supplier: <span className="font-medium text-slate-800">{b.supplierName}</span> •
                    Purchased {b.purchaseDateLabel} • {b.logCount} logs & tray records
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBatchFilter(b.letter);
                      setActiveTab("crabs");
                    }}
                  >
                    Filter Crabs ({b.crabCount})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeletingBatch(b)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Batch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Crab to Existing Batch"
        description={
          nextCodePreview
            ? `Next auto-generated code: ${nextCodePreview}`
            : undefined
        }
      >
        <form onSubmit={handleAddToBatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ab-batch">Batch *</Label>
              <Select
                id="ab-batch"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                required
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.letter} ({b.supplierName})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ab-tray">Empty Tray *</Label>
              <Select
                id="ab-tray"
                value={trayId}
                onChange={(e) => setTrayId(e.target.value)}
                required
              >
                {emptyTrays.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tray {t.number}
                    {t.isTreatmentTray ? " (Treatment)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ab-sex">Sex</Label>
              <Select
                id="ab-sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as "MALE" | "FEMALE")}
              >
                <option value="MALE">MALE</option>
                <option value="FEMALE">FEMALE</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ab-wt">Initial Weight (g) *</Label>
              <Input
                id="ab-wt"
                type="number"
                step="any"
                min="1"
                value={initialWeightG}
                onChange={(e) => setInitialWeightG(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ab-cost">Purchase Cost (₹) *</Label>
              <Input
                id="ab-cost"
                type="number"
                step="any"
                min="0"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ab-stocked">Stocked Date *</Label>
              <Input
                id="ab-stocked"
                type="date"
                value={stockedDate}
                onChange={(e) => setStockedDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ab-harvest">Expected Harvest (optional)</Label>
              <Input
                id="ab-harvest"
                type="date"
                value={expectedHarvestDate}
                onChange={(e) => setExpectedHarvestDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ab-notes">Notes (optional)</Label>
            <Textarea
              id="ab-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || emptyTrays.length === 0}>
              <Shell className="h-4 w-4" />
              {submitting ? "Adding..." : `Add Crab ${nextCodePreview}`}
            </Button>
          </div>
        </form>
      </Dialog>

      <TypedConfirmDeleteDialog
        open={Boolean(deletingBatch)}
        onOpenChange={(open) => {
          if (!open) setDeletingBatch(null);
        }}
        title={deletingBatch ? `Delete Batch ${deletingBatch.letter}` : "Delete Batch"}
        requiredText={deletingBatch?.letter ?? ""}
        warningItems={
          deletingBatch
            ? [
                `Batch ${deletingBatch.letter} (${deletingBatch.supplierName})`,
                `${deletingBatch.crabCount} crab record(s) (${deletingBatch.openCrabCount} still ACTIVE/SICK will be freed from trays)`,
                `${deletingBatch.logCount} feed, weight, molt, treatment, and tray history logs plus any linked sales`,
                "Batch letters are never reused — the next batch letter keeps advancing.",
              ]
            : []
        }
        recommendation="Only delete a batch if it was entered by mistake (e.g. testing)."
        pending={batchDeletePending}
        onConfirm={handleConfirmDeleteBatch}
      />
    </div>
  );
}

