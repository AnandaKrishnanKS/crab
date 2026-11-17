"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SafeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  itemName: string;
  blockedMessage?: string | null;
  canDeactivate?: boolean;
  pending?: boolean;
  onDelete: () => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
}

export function SafeDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  itemName,
  blockedMessage,
  canDeactivate = true,
  pending = false,
  onDelete,
  onDeactivate,
}: SafeDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={blockedMessage ? `Cannot delete ${entityLabel}` : `Delete ${entityLabel}`}
    >
      <div className="space-y-4">
        {blockedMessage ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 space-y-1.5">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
              <span>History preserved</span>
            </div>
            <p>{blockedMessage}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            Are you sure you want to permanently delete{" "}
            <span className="font-bold text-slate-900">{itemName}</span>?
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {blockedMessage && canDeactivate && onDeactivate ? (
            <Button onClick={onDeactivate} disabled={pending}>
              {pending ? "Updating..." : "Deactivate instead"}
            </Button>
          ) : !blockedMessage ? (
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
            >
              {pending ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

