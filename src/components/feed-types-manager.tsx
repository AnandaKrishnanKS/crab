"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFeedTypeAction,
  toggleFeedTypeActiveAction,
  upsertFeedTypeAction,
} from "@/app/actions/master-data";
import { SafeDeleteDialog } from "@/components/safe-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs } from "@/components/ui/tabs";
import { formatINR, formatMineralQuantityG } from "@/lib/format";

export interface FeedTypeRow {
  id: string;
  name: string;
  costPerKg: number;
  active: boolean;
  logCount: number;
  totalQuantityG: number;
  totalCost: number;
}

export interface CrabFeedCostRow {
  crabId: string;
  code: string;
  batchLetter: string;
  status: "ACTIVE" | "SICK" | "SOLD" | "DEAD";
  logCount: number;
  totalQuantityG: number;
  totalCost: number;
}

export function FeedTypesManager({
  feedTypes,
  crabFeedCosts,
}: {
  feedTypes: FeedTypeRow[];
  crabFeedCosts: CrabFeedCostRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"types" | "per-crab">("types");
  const [onlyOpenCrabs, setOnlyOpenCrabs] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FeedTypeRow | null>(null);
  const [name, setName] = React.useState("");
  const [costPerKg, setCostPerKg] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<FeedTypeRow | null>(null);
  const [blockedMsg, setBlockedMsg] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCostPerKg("");
    setActive(true);
    setFormOpen(true);
  };

  const openEdit = (ft: FeedTypeRow) => {
    setEditing(ft);
    setName(ft.name);
    setCostPerKg(String(ft.costPerKg));
    setActive(ft.active);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await upsertFeedTypeAction({
      id: editing?.id,
      name,
      costPerKg: Number(costPerKg),
      active,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Feed type updated" : "Feed type added");
    setFormOpen(false);
    router.refresh();
  };

  const handleToggleActive = async (ft: FeedTypeRow) => {
    const res = await toggleFeedTypeActiveAction(ft.id, !ft.active);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${ft.name} ${ft.active ? "deactivated" : "activated"}`);
    router.refresh();
  };

  const openDelete = (ft: FeedTypeRow) => {
    setDeleteTarget(ft);
    setBlockedMsg(
      ft.logCount > 0
        ? `${ft.name} is used in ${ft.logCount} feeding log${ft.logCount === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`
        : null
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const res = await deleteFeedTypeAction(deleteTarget.id);
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
    const res = await toggleFeedTypeActiveAction(deleteTarget.id, false);
    setDeletePending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${deleteTarget.name} deactivated`);
    setDeleteTarget(null);
    router.refresh();
  };

  const visibleCrabs = onlyOpenCrabs
    ? crabFeedCosts.filter((c) => c.status === "ACTIVE" || c.status === "SICK")
    : crabFeedCosts;

  const totalFeedCostAll = crabFeedCosts.reduce((s, c) => s + c.totalCost, 0);
  const totalFeedQtyAll = crabFeedCosts.reduce((s, c) => s + c.totalQuantityG, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Feed Types &amp; Cost
          </h1>
          <p className="text-sm text-slate-600">
            Price changes update future logs only; historical feed logs keep cost at time.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Feed Type
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "types", label: "Feed Types", count: feedTypes.length },
          { id: "per-crab", label: "Feed Cost per Crab", count: crabFeedCosts.length },
        ]}
      />

      {tab === "types" ? (
        feedTypes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-600">
              No feed types added yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feedTypes.map((ft) => (
              <Card
                key={ft.id}
                className={!ft.active ? "bg-slate-100/80 opacity-85" : undefined}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{ft.name}</h2>
                        <Badge variant={ft.active ? "teal" : "default"}>
                          {ft.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-bold text-teal-800">
                        {formatINR(ft.costPerKg)} / kg
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <div className="font-bold text-slate-900">{formatINR(ft.totalCost)}</div>
                      <div>
                        {formatMineralQuantityG(ft.totalQuantityG)} ({ft.logCount} logs)
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                    <Button size="sm" variant="outline" onClick={() => openEdit(ft)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(ft)}
                    >
                      {ft.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => openDelete(ft)}
                      aria-label={`Delete feed type ${ft.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Feed Cost per Crab</CardTitle>
              <CardDescription>
                Total logged across all crabs: {formatMineralQuantityG(totalFeedQtyAll)} •{" "}
                {formatINR(totalFeedCostAll)}
              </CardDescription>
            </div>
            <label className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyOpenCrabs}
                onChange={(e) => setOnlyOpenCrabs(e.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              Active &amp; Sick only
            </label>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {visibleCrabs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">
                No crabs match this filter.
              </p>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                  <tr>
                    <th className="px-2 sm:px-3 py-2.5 font-semibold">Crab</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-semibold">Batch</th>
                    <th className="px-2 sm:px-3 py-2.5 font-semibold">Status</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-semibold text-right">Feedings</th>
                    <th className="px-2 sm:px-3 py-2.5 font-semibold text-right">Total Feed</th>
                    <th className="px-2 sm:px-3 py-2.5 font-semibold text-right">Feed Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleCrabs.map((c) => (
                    <tr key={c.crabId} className="hover:bg-slate-50">
                      <td className="px-2 sm:px-3 py-2.5 font-bold whitespace-nowrap">
                        <Link
                          href={`/crabs/${c.crabId}`}
                          className="text-teal-800 underline underline-offset-2"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-slate-700">{c.batchLetter}</td>
                      <td className="px-2 sm:px-3 py-2.5">
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
                      <td className="hidden sm:table-cell px-3 py-2.5 text-right text-slate-700">{c.logCount}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">
                        {formatMineralQuantityG(c.totalQuantityG)}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(c.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Edit ${editing.name}` : "Add Feed Type"}
        description="Cost per kg applies to new feedings from now on."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="ft-name">Feed Name *</Label>
            <Input
              id="ft-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trash fish, Squid, Clam, Pellet"
              required
            />
          </div>
          <div>
            <Label htmlFor="ft-cost">Cost per kg (₹) *</Label>
            <Input
              id="ft-cost"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={costPerKg}
              onChange={(e) => setCostPerKg(e.target.value)}
              placeholder="e.g. 120"
              required
            />
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
              <Utensils className="h-4 w-4" />
              {submitting ? "Saving..." : editing ? "Save Feed Type" : "Create Feed Type"}
            </Button>
          </div>
        </form>
      </Dialog>

      <SafeDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        entityLabel="feed type"
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

