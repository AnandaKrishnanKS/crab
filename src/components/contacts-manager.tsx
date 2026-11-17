"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteBuyerAction,
  deleteSupplierAction,
  toggleBuyerActiveAction,
  toggleSupplierActiveAction,
  upsertBuyerAction,
  upsertSupplierAction,
} from "@/app/actions/master-data";
import { SafeDeleteDialog } from "@/components/safe-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateIN, formatINR, formatNumberIN } from "@/lib/format";

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  batches: Array<{
    id: string;
    letter: string;
    purchaseDate: string;
    pricePerKg: number | null;
    crabCount: number;
    totalSpend: number;
  }>;
}

export interface BuyerRow {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  sales: Array<{
    id: string;
    crabId: string;
    crabCode: string;
    date: string;
    weightG: number;
    pricePerKg: number;
    totalAmount: number;
    paymentStatus: "PAID" | "PENDING";
  }>;
}

type ContactKind = "supplier" | "buyer";

interface EditableContact {
  id?: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  historyCount: number;
}

export function ContactsManager({
  suppliers,
  buyers,
}: {
  suppliers: SupplierRow[];
  buyers: BuyerRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<ContactKind>("supplier");
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKind, setFormKind] = React.useState<ContactKind>("supplier");
  const [editing, setEditing] = React.useState<EditableContact | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<{
    kind: ContactKind;
    contact: EditableContact;
  } | null>(null);
  const [blockedMsg, setBlockedMsg] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreate = (kind: ContactKind) => {
    setFormKind(kind);
    setEditing(null);
    setName("");
    setPhone("");
    setLocation("");
    setNotes("");
    setActive(true);
    setFormOpen(true);
  };

  const openEdit = (kind: ContactKind, contact: EditableContact) => {
    setFormKind(kind);
    setEditing(contact);
    setName(contact.name);
    setPhone(contact.phone ?? "");
    setLocation(contact.location ?? "");
    setNotes(contact.notes ?? "");
    setActive(contact.active);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      id: editing?.id,
      name,
      phone,
      location,
      notes,
      active,
    };
    const res =
      formKind === "supplier"
        ? await upsertSupplierAction(payload)
        : await upsertBuyerAction(payload);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${formKind === "supplier" ? "Supplier" : "Buyer"} ${editing ? "updated" : "added"}`
    );
    setFormOpen(false);
    router.refresh();
  };

  const handleToggleActive = async (kind: ContactKind, id: string, current: boolean) => {
    const res =
      kind === "supplier"
        ? await toggleSupplierActiveAction(id, !current)
        : await toggleBuyerActiveAction(id, !current);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${kind === "supplier" ? "Supplier" : "Buyer"} ${current ? "deactivated" : "activated"}`
    );
    router.refresh();
  };

  const openDelete = (kind: ContactKind, contact: EditableContact) => {
    setDeleteTarget({ kind, contact });
    setBlockedMsg(
      contact.historyCount > 0
        ? `${contact.name} is linked to ${contact.historyCount} ${
            kind === "supplier" ? "batch" : "sale"
          }${contact.historyCount === 1 ? "" : kind === "supplier" ? "es" : "s"}, so it cannot be deleted. Deactivate it instead?`
        : null
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.contact.id) return;
    setDeletePending(true);
    const res =
      deleteTarget.kind === "supplier"
        ? await deleteSupplierAction(deleteTarget.contact.id)
        : await deleteBuyerAction(deleteTarget.contact.id);
    setDeletePending(false);

    if (!res.ok) {
      if (res.blockedByHistory) {
        setBlockedMsg(res.error);
      } else {
        toast.error(res.error);
      }
      return;
    }
    toast.success(
      `${deleteTarget.kind === "supplier" ? "Supplier" : "Buyer"} deleted`
    );
    setDeleteTarget(null);
    router.refresh();
  };

  const handleDeactivateFromDelete = async () => {
    if (!deleteTarget?.contact.id) return;
    setDeletePending(true);
    const res =
      deleteTarget.kind === "supplier"
        ? await toggleSupplierActiveAction(deleteTarget.contact.id, false)
        : await toggleBuyerActiveAction(deleteTarget.contact.id, false);
    setDeletePending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${deleteTarget.kind === "supplier" ? "Supplier" : "Buyer"} deactivated`
    );
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Suppliers &amp; Buyers
          </h1>
          <p className="text-sm text-slate-600">
            Track crab suppliers, harvest buyers, and complete purchase &amp; sales history.
          </p>
        </div>
        <Button onClick={() => openCreate(tab)}>
          <Plus className="h-4 w-4" />
          Add {tab === "supplier" ? "Supplier" : "Buyer"}
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "supplier", label: "Suppliers", count: suppliers.length },
          { id: "buyer", label: "Buyers", count: buyers.length },
        ]}
      />

      {tab === "supplier" ? (
        suppliers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-600">
              No suppliers yet. Add your first crab supplier.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => {
              const totalCrabs = s.batches.reduce((acc, b) => acc + b.crabCount, 0);
              const totalSpend = s.batches.reduce((acc, b) => acc + b.totalSpend, 0);
              const expanded = Boolean(expandedIds[s.id]);
              const contactMeta: EditableContact = {
                id: s.id,
                name: s.name,
                phone: s.phone,
                location: s.location,
                notes: s.notes,
                active: s.active,
                historyCount: s.batches.length,
              };

              return (
                <Card key={s.id} className={!s.active ? "bg-slate-100/80 opacity-85" : undefined}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">{s.name}</h2>
                          <Badge variant={s.active ? "teal" : "default"}>
                            {s.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          {s.phone && (
                            <a
                              href={`tel:${s.phone}`}
                              className="inline-flex items-center gap-1 font-medium text-teal-800 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {s.phone}
                            </a>
                          )}
                          {s.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {s.location}
                            </span>
                          )}
                        </div>
                        {s.notes && (
                          <p className="mt-1.5 text-xs text-slate-600">{s.notes}</p>
                        )}
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatINR(totalSpend)}
                        </div>
                        <div className="text-xs text-slate-600">
                          {s.batches.length} batch{s.batches.length === 1 ? "" : "es"} • {totalCrabs} crab{totalCrabs === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                      {s.batches.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleExpand(s.id)}
                        >
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          Purchases ({s.batches.length})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit("supplier", contactMeta)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive("supplier", s.id, s.active)}
                      >
                        {s.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => openDelete("supplier", contactMeta)}
                        aria-label={`Delete supplier ${s.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {expanded && s.batches.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-x-auto">
                        <table className="w-full text-left text-[11px] sm:text-xs">
                          <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                            <tr>
                              <th className="px-2 py-2 font-semibold">Batch</th>
                              <th className="px-2 py-2 font-semibold">Date</th>
                              <th className="px-2 py-2 font-semibold">Crabs</th>
                              <th className="px-2 py-2 font-semibold">Rate/kg</th>
                              <th className="px-2 py-2 font-semibold text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {s.batches.map((b) => (
                              <tr key={b.id}>
                                <td className="px-2 py-2 font-bold text-slate-900 whitespace-nowrap">
                                  {b.letter}
                                </td>
                                <td className="px-2 py-2 text-slate-700 whitespace-nowrap">
                                  {formatDateIN(b.purchaseDate)}
                                </td>
                                <td className="px-2 py-2 text-slate-700">{b.crabCount}</td>
                                <td className="px-2 py-2 text-slate-700 whitespace-nowrap">
                                  {b.pricePerKg !== null ? formatINR(b.pricePerKg) : "—"}
                                </td>
                                <td className="px-2 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                                  {formatINR(b.totalSpend)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : buyers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            No buyers yet. Add your first crab buyer.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {buyers.map((b) => {
            const totalRevenue = b.sales.reduce((acc, s) => acc + s.totalAmount, 0);
            const pendingAmount = b.sales
              .filter((s) => s.paymentStatus === "PENDING")
              .reduce((acc, s) => acc + s.totalAmount, 0);
            const expanded = Boolean(expandedIds[b.id]);
            const contactMeta: EditableContact = {
              id: b.id,
              name: b.name,
              phone: b.phone,
              location: b.location,
              notes: b.notes,
              active: b.active,
              historyCount: b.sales.length,
            };

            return (
              <Card key={b.id} className={!b.active ? "bg-slate-100/80 opacity-85" : undefined}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{b.name}</h2>
                        <Badge variant={b.active ? "teal" : "default"}>
                          {b.active ? "Active" : "Inactive"}
                        </Badge>
                        {pendingAmount > 0 && (
                          <Badge variant="warning">
                            Pending {formatINR(pendingAmount)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {b.phone && (
                          <a
                            href={`tel:${b.phone}`}
                            className="inline-flex items-center gap-1 font-medium text-teal-800 hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {b.phone}
                          </a>
                        )}
                        {b.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {b.location}
                          </span>
                        )}
                      </div>
                      {b.notes && (
                        <p className="mt-1.5 text-xs text-slate-600">{b.notes}</p>
                      )}
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {formatINR(totalRevenue)}
                      </div>
                      <div className="text-xs text-slate-600">
                        {b.sales.length} sale{b.sales.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                    {b.sales.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleExpand(b.id)}
                      >
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Sales ({b.sales.length})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit("buyer", contactMeta)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive("buyer", b.id, b.active)}
                    >
                      {b.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => openDelete("buyer", contactMeta)}
                      aria-label={`Delete buyer ${b.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {expanded && b.sales.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-x-auto">
                      <table className="w-full text-left text-[11px] sm:text-xs">
                        <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-2 py-2 font-semibold">Crab</th>
                            <th className="px-2 py-2 font-semibold">Date</th>
                            <th className="px-2 py-2 font-semibold">Wt</th>
                            <th className="px-2 py-2 font-semibold">Status</th>
                            <th className="px-2 py-2 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {b.sales.map((sale) => (
                            <tr key={sale.id}>
                              <td className="px-2 py-2 font-bold">
                                <Link
                                  href={`/crabs/${sale.crabId}`}
                                  className="text-teal-800 underline underline-offset-2"
                                >
                                  {sale.crabCode}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-slate-700 whitespace-nowrap">
                                {formatDateIN(sale.date)}
                              </td>
                              <td className="px-2 py-2 text-slate-700 whitespace-nowrap">
                                {formatNumberIN(sale.weightG, 0)} g
                              </td>
                              <td className="px-2 py-2">
                                <Badge
                                  variant={
                                    sale.paymentStatus === "PAID" ? "success" : "warning"
                                  }
                                >
                                  {sale.paymentStatus}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                                {formatINR(sale.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={`${editing ? "Edit" : "Add"} ${formKind === "supplier" ? "Supplier" : "Buyer"}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                formKind === "supplier" ? "e.g. Sundarbans Crab Co." : "e.g. Marina Seafood Exports"
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="contact-phone">Phone (optional)</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98..."
            />
          </div>
          <div>
            <Label htmlFor="contact-location">Location (optional)</Label>
            <Input
              id="contact-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City / Landing centre"
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
          <div>
            <Label htmlFor="contact-notes">Notes (optional)</Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Grading terms, credit days, pickup notes..."
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      <SafeDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        entityLabel={deleteTarget?.kind ?? "contact"}
        itemName={deleteTarget?.contact.name ?? ""}
        blockedMessage={blockedMsg}
        canDeactivate={Boolean(deleteTarget?.contact.active)}
        pending={deletePending}
        onDelete={handleConfirmDelete}
        onDeactivate={handleDeactivateFromDelete}
      />
    </div>
  );
}

