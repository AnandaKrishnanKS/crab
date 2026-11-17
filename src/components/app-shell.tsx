"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Box,
  ClipboardCheck,
  Droplets,
  Home,
  LayoutGrid,
  LogOut,
  Plus,
  Receipt,
  Scale,
  Settings,
  Shell,
  Users,
  Utensils,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CrabLogo } from "@/components/crab-logo";
import { Dialog } from "@/components/ui/dialog";
import { logoutAction } from "@/app/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchExact?: boolean;
}

const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, matchExact: true },
  { href: "/daily", label: "Daily Log", icon: ClipboardCheck },
  { href: "/crabs", label: "Crabs", icon: Shell },
  { href: "/water", label: "Water", icon: Droplets },
  { href: "/more", label: "More", icon: LayoutGrid },
];

const DESKTOP_SECONDARY_NAV: NavItem[] = [
  { href: "/trays", label: "Trays", icon: Box },
  { href: "/contacts", label: "Suppliers & Buyers", icon: Users },
  { href: "/feed-types", label: "Feed Types", icon: Utensils },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports (₹)", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const QUICK_ADD_LINKS = [
  {
    href: "/daily#water-test",
    label: "Log Water Test",
    sub: "Whole-RAS salinity, pH, ammonia",
    icon: Droplets,
  },
  {
    href: "/daily#feed",
    label: "Feed Crabs",
    sub: "Fast feeding table for active crabs",
    icon: Utensils,
  },
  {
    href: "/daily#weight-molt",
    label: "Weight / Molt",
    sub: "Quick per-crab weight & stage",
    icon: Scale,
  },
  {
    href: "/batches/new",
    label: "Add Batch",
    sub: "Stock new crabs into empty trays",
    icon: Shell,
  },
  {
    href: "/expenses?new=1",
    label: "Add Expense",
    sub: "Electricity, labour, equipment, transport",
    icon: Receipt,
  },
  {
    href: "/water?tab=maintenance&new=1",
    label: "Maintenance Log",
    sub: "Top-up, filter clean, UV/pump service",
    icon: Wrench,
  },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.matchExact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  userEmail,
  children,
}: {
  userEmail?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white shadow-xs">
            <CrabLogo className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight text-slate-900">
              MudCrab Manager
            </div>
            <div className="text-xs text-slate-500">Single-RAS Tracker</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div className="space-y-1">
            {MOBILE_NAV.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-teal-900 border border-teal-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Farm &amp; Records
            </div>
            {DESKTOP_SECONDARY_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-teal-900 border border-teal-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-2">
          {userEmail && (
            <div className="px-2 text-xs text-slate-500 truncate">
              Signed in as {userEmail}
            </div>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-800 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex md:hidden items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shadow-xs">
            <CrabLogo className="h-5 w-5 text-white" />
          </span>
          <span className="text-base font-bold text-slate-900">
            MudCrab Manager
          </span>
        </Link>
        <Link
          href="/daily"
          className="inline-flex min-h-9 items-center rounded-lg bg-teal-50 border border-teal-200 px-3 text-xs font-bold text-teal-900"
        >
          Daily Log
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 pb-32 md:pb-12">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</div>
      </main>

      {/* Floating Quick-Add Button */}
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Quick add"
        className="fixed right-4 bottom-20 md:right-6 md:bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 cursor-pointer"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Mobile Bottom Nav */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold",
                active ? "text-teal-800 bg-teal-50/70" : "text-slate-600"
              )}
            >
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-teal-700" />
              )}
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick-Add Sheet */}
      <Dialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        title="Quick Add"
        description="Jump directly to log daily farm activity"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {QUICK_ADD_LINKS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setQuickAddOpen(false)}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {action.label}
                  </div>
                  <div className="text-xs text-slate-600">{action.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}

