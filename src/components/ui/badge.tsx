import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-slate-300 bg-slate-100 text-slate-800",
        success: "border-emerald-300 bg-emerald-50 text-emerald-900",
        warning: "border-amber-300 bg-amber-50 text-amber-900",
        danger: "border-red-300 bg-red-50 text-red-900",
        teal: "border-teal-300 bg-teal-50 text-teal-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

