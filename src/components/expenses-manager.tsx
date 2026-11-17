"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDateIN, formatINR, toISTDateString } from "@/lib/format";

export type ExpenseCategoryValue =
  | "ELECTRICITY"
  | "LABOUR"
  | "EQUIPMENT"
  | "TRANSPORT"
  | "OTHER";

export interface ExpenseRow {
  id: string;
  date: string;
  ymKey: string;
  category: ExpenseCategoryValue;
  amount: number;
  notes: string | null;
}

const CATEGORY_LABELS: Record<ExpenseCategoryValue, string> = {
  ELECTRICITY: "Electricity",
  LABOUR: "Labour",
  EQUIPMENT: "Equipment",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

export function ExpensesManager({
  expenses,
  defaultDateYmd,
  initialOpenNew,
}: {
  expenses: ExpenseRow[];
  defaultDateYmd: string;
  initialOpenNew: boolean;
}) {
  const router = useRouter();
  const [monthFilter, setMonthFilter] = React.useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  const [dialogOpen, setDialogOpen] = React.useState(initialOpenNew);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(defaultDateYmd);
  const [category, setCategory] =
    React.useState<ExpenseCategoryValue>("ELECTRICITY");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const [deleting, setDeleting] = React.useState<ExpenseRow | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const monthOptions = Array.from(new Set(expenses.map((e) => e.ymKey))).sort(
    (a, b) => b.localeCompare(a)
  );

  const filtered = expenses.filter((e) => {
    if (monthFilter !== "ALL" && e.ymKey !== monthFilter) return false;
    if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = Object.keys(CATEGORY_LABELS).map((cat) => {
    const k = cat as ExpenseCategoryValue;
    const sum = filtered
      .filter((e) => e.category === k)
      .reduce((acc, e) => acc + e.amount, 0);
    return { category: k, label: CATEGORY_LABELS[k], sum };
  });

  const openAdd = () => {
    setEditingId(null);
    setDate(defaultDateYmd);
    setCategory("ELECTRICITY");
    setAmount("");
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (row: ExpenseRow) => {
    setEditingId(row.id);
    setDate(toISTDateString(new Date(row.date)));
    setCategory(row.category);
    setAmount(String(row.amount));
    setNotes(row.notes ?? "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const payload = {
      id: editingId ?? undefined,
      date,
      category,
      amount: Number(amount),
      notes,
    };
    const res = editingId
      ? await updateExpenseAction(payload)
      : await addExpenseAction(payload);
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Saved expense");
    setDialogOpen(false);
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    const res = await deleteExpenseAction(deleting.id);
    setDeletePending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? "Deleted expense");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Farm Expenses
          </h1>
          <p className="text-sm text-slate-600">
            Track shared RAS operating costs (electricity, labour, equipment, transport). Crab
            purchases, feed, treatments, and water chemicals are tracked via their own logs.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Select
          aria-label="Filter by month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="ALL">All Months ({expenses.length})</option>
          {monthOptions.map((ym) => {
            const [y, m] = ym.split("-");
            return (
              <option key={ym} value={ym}>
                {m}/{y}
              </option>
            );
          })}
        </Select>
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        <Card className="bg-slate-50">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Filtered Total</span>
            <span className="text-lg font-extrabold text-slate-900">
              {formatINR(filteredTotal)}
            </span>
          </CardContent>
        </Card>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryTotals
            .filter((c) => c.sum > 0)
            .map((c) => (
              <Badge key={c.category} variant="default" className="px-3 py-1 text-xs">
                {c.label}: {formatINR(c.sum)}
              </Badge>
            ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-teal-700" />
            Expense Entries ({filtered.length})
          </CardTitle>
          <CardDescription>
            Tap Edit or Delete on any entry to adjust records.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No expenses match the selected filters.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {formatDateIN(new Date(row.date))}
                      </span>
                      <Badge variant="teal">{CATEGORY_LABELS[row.category]}</Badge>
                      <span className="text-base font-extrabold text-slate-900">
                        {formatINR(row.amount)}
                      </span>
                    </div>
                    {row.notes && (
                      <div className="text-xs text-slate-600">{row.notes}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(row)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(row)}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? "Edit Expense" : "Log Operating Expense"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-date">Date *</Label>
              <Input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="exp-cat">Category *</Label>
              <Select
                id="exp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategoryValue)}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="exp-amount">Amount (₹) *</Label>
            <Input
              id="exp-amount"
              type="number"
              step="any"
              min="0.01"
              placeholder="e.g. 2400"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="exp-notes">Notes (optional)</Label>
            <Textarea
              id="exp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bill month, helper days, spare parts..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Expense?"
        description={
          deleting
            ? `Delete ${CATEGORY_LABELS[deleting.category]} expense of ${formatINR(
                deleting.amount
              )} from ${formatDateIN(new Date(deleting.date))}?`
            : ""
        }
        pending={deletePending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

