import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, inputMode, ...props }, ref) => {
  const resolvedInputMode =
    inputMode ?? (type === "number" ? "decimal" : undefined);
  return (
    <input
      ref={ref}
      type={type}
      inputMode={resolvedInputMode}
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

