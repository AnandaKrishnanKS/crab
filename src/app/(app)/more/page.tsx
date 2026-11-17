import Link from "next/link";
import {
  BarChart3,
  Box,
  ChevronRight,
  LogOut,
  PlusCircle,
  Receipt,
  Settings,
  Users,
  Utensils,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

const MORE_ITEMS = [
  {
    href: "/trays",
    title: "Trays",
    description: "Manage boxes 01..N, treatment flag, and tray history",
    icon: Box,
  },
  {
    href: "/batches/new",
    title: "Add Batch",
    description: "Stock a new batch of mud crabs into empty trays",
    icon: PlusCircle,
  },
  {
    href: "/contacts",
    title: "Suppliers & Buyers",
    description: "Manage crab suppliers, buyers, and order history",
    icon: Users,
  },
  {
    href: "/feed-types",
    title: "Feed Types",
    description: "Manage feed pricing (₹/kg) and feed cost per crab",
    icon: Utensils,
  },
  {
    href: "/expenses",
    title: "Expenses",
    description: "Electricity, labour, equipment, transport & other costs",
    icon: Receipt,
  },
  {
    href: "/reports",
    title: "Reports (₹)",
    description: "Monthly P&L, batch returns, growth KPIs & CSV exports",
    icon: BarChart3,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "RAS thresholds, system volume, minerals, password, backup",
    icon: Settings,
  },
];

export default function MorePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">More</h1>
        <p className="text-sm text-slate-600">
          Farm setup, contacts, finances, reports, and account
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 flex items-center justify-between gap-3 hover:border-teal-400 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600">
                      {item.description}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="p-4">
        <form action={logoutAction} className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">Account Session</div>
            <div className="text-xs text-slate-600">
              Sign out from MudCrab Manager on this device
            </div>
          </div>
          <Button type="submit" variant="destructive" className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}

