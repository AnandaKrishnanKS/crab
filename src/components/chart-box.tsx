"use client";

import * as React from "react";

const emptySubscribe = () => () => {};

export function ChartBox({
  height = 240,
  children,
}: {
  height?: number;
  children: React.ReactNode;
}) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <div style={{ width: "100%", height }} className="min-w-0">
      {isClient ? (
        children
      ) : (
        <div className="h-full w-full rounded-lg bg-slate-100 animate-pulse" />
      )}
    </div>
  );
}

