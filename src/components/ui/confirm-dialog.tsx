"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

interface SimpleConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Delete entry",
  description = "Are you sure you want to delete this entry?",
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: SimpleConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{description}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface TypedConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  requiredText: string;
  warningItems: string[];
  recommendation?: string;
  pending?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function TypedConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  requiredText,
  warningItems,
  recommendation,
  pending = false,
  onConfirm,
}: TypedConfirmDeleteDialogProps) {
  const [typed, setTyped] = React.useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  const matches = typed.trim() === requiredText;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={title}>
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Permanent Deletion Warning</span>
          </div>
          <p>This action permanently deletes the following records:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {warningItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {recommendation && (
            <p className="font-semibold pt-1 text-red-950">{recommendation}</p>
          )}
        </div>

        <div>
          <Label htmlFor="typed-delete-confirm">
            Type <span className="font-mono font-bold">{requiredText}</span> to confirm
          </Label>
          <Input
            id="typed-delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requiredText}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || pending}
          >
            {pending ? "Deleting..." : "Permanently Delete"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
