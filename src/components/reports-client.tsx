"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, IndianRupee } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { markSalePaidAction } from "@/app/actions/expenses";
import { ChartBox } from "@/components/chart-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { formatINR, formatNumberIN } from "@/lib/format";
import {
  type BatchPnlRow,
  type CrabPnlRow,
  type FarmKpis,
  type MonthlyPnlRow,
  toCsv,
  type TraySummaryRow,
} from "@/lib/reports";

export interface PendingSaleRow {
  saleId: string;
  crabId: string;
  crabCode: string;
  buyerName: string;
  dateLabel: string;
  weightG: number;
  totalAmount: number;
}

function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
) {
  const csv = "\uFEFF" + toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  kpis,
  monthlyPnl,
  pendingSales,
  batchPnl,
  crabPnl,
  traySummary,
}: {
  kpis: FarmKpis;
  monthlyPnl: MonthlyPnlRow[];
  pendingSales: PendingSaleRow[];
  batchPnl: BatchPnlRow[];
  crabPnl: CrabPnlRow[];
  traySummary: TraySummaryRow[];
}) {
  const router = useRouter();
  const [reportTab, setReportTab] = React.useState<
    "monthly" | "batches" | "crabs" | "trays"
  >("monthly");
  const [crabStatusFilter, setCrabStatusFilter] = React.useState("ALL");
  const [payingId, setPayingId] = React.useState<string | null>(null);

  const handleMarkPaid = async (saleId: string, crabCode: string) => {
    setPayingId(saleId);
    const res = await markSalePaidAction(saleId);
    setPayingId(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Payment for crab ${crabCode} marked PAID.`);
    router.refresh();
  };

  const filteredCrabs = crabPnl.filter(
    (c) => crabStatusFilter === "ALL" || c.status === crabStatusFilter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reports &amp; P&amp;L (₹)
          </h1>
          <p className="text-sm text-slate-600">
            Monthly profit, non-overlapping expenses, batch &amp; crab economics, tray performance,
            and CSV exports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/csv"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            All CSV (ZIP)
          </a>
          <a
            href="/api/export/json"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            JSON Backup
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Avg Growth Rate</div>
            <div className="text-xl font-extrabold text-teal-900 mt-0.5">
              {kpis.avgGrowthGPerDay !== null
                ? `${formatNumberIN(kpis.avgGrowthGPerDay, 2)} g/day`
                : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {kpis.totalCrabs} total crabs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Avg Days to Sale</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {kpis.avgDaysToSale !== null
                ? `${formatNumberIN(kpis.avgDaysToSale, 1)} d`
                : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {kpis.soldCount} sold • {kpis.activeCount} active
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Mortality &amp; Sick</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {kpis.mortalityRatePct !== null
                ? `${formatNumberIN(kpis.mortalityRatePct, 1)}%`
                : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {kpis.deadCount} dead • {kpis.sickCount} sick now
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.pendingPaymentsCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="p-3.5">
            <div className="text-xs font-semibold text-slate-500">Pending Payments</div>
            <div className="text-xl font-extrabold text-amber-900 mt-0.5">
              {formatINR(kpis.pendingPaymentsAmount)}
            </div>
            <div className="text-[11px] text-slate-600">
              {kpis.pendingPaymentsCount} unpaid sale(s)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments Quick Action */}
      {pendingSales.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="h-4 w-4 text-amber-700" />
              Pending Sale Payments ({pendingSales.length})
            </CardTitle>
            <CardDescription>
              Mark payments settled once received from the buyer.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {pendingSales.map((p) => (
                <div
                  key={p.saleId}
                  className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="text-sm">
                    <Link
                      href={`/crabs/${p.crabId}`}
                      className="font-mono font-bold text-teal-800 hover:underline mr-2"
                    >
                      {p.crabCode}
                    </Link>
                    <span className="font-semibold text-slate-900">{p.buyerName}</span>
                    <span className="text-xs text-slate-600 ml-2">
                      {p.dateLabel} • {formatNumberIN(p.weightG, 0)} g
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-extrabold text-slate-900">
                      {formatINR(p.totalAmount)}
                    </span>
                    <Button
                      size="sm"
                      disabled={payingId === p.saleId}
                      onClick={() => handleMarkPaid(p.saleId, p.crabCode)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {payingId === p.saleId ? "Saving..." : "Mark Paid"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={reportTab}
        onChange={setReportTab}
        options={[
          { id: "monthly", label: "Monthly P&L", count: monthlyPnl.length },
          { id: "batches", label: "Batch P&L", count: batchPnl.length },
          { id: "crabs", label: "Crab P&L", count: crabPnl.length },
          { id: "trays", label: "Tray P&L", count: traySummary.length },
        ]}
      />

      {/* TAB 1: MONTHLY P&L */}
      {reportTab === "monthly" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Monthly Sales, Expenses &amp; Net Profit (₹)</CardTitle>
                  <CardDescription>
                    Uses crab stocking costs, feed log costs, treatments, minerals, RAS maintenance,
                    and operating expenses without double counting.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsvFile(
                      "mudcrab-monthly-pnl.csv",
                      [
                        "Month",
                        "Sales Revenue (INR)",
                        "Crab Purchases (INR)",
                        "Feed Cost (INR)",
                        "Treatments (INR)",
                        "Water Chemicals (INR)",
                        "RAS Maintenance (INR)",
                        "Operating Expenses (INR)",
                        "Total Expenses (INR)",
                        "Net Profit (INR)",
                      ],
                      monthlyPnl.map((m) => [
                        m.monthLabel,
                        m.salesRevenue,
                        m.crabPurchasesCost,
                        m.feedCost,
                        m.treatmentCost,
                        m.mineralCost,
                        m.maintenanceCost,
                        m.operatingExpensesCost,
                        m.totalExpenses,
                        m.netProfit,
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {monthlyPnl.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">
                  No financial transactions recorded yet.
                </p>
              ) : (
                <>
                  <ChartBox height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyPnl}
                        margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 11, fill: "#475569" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#475569" }}
                          width={64}
                          tickFormatter={(v: number) => `₹${formatNumberIN(v, 0)}`}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            formatINR(Number(value ?? 0)),
                            String(name),
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Bar
                          dataKey="salesRevenue"
                          name="Sales"
                          fill="#0f766e"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="totalExpenses"
                          name="Expenses"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="netProfit"
                          name="Net Profit"
                          fill="#0284c7"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartBox>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Month</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Revenue</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Stocked</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Feed</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Chem</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Tx/Maint</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Ops</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Total Out</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Net Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[...monthlyPnl].reverse().map((m) => (
                          <tr key={m.ymKey}>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {m.monthLabel}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatINR(m.salesRevenue)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatINR(m.crabPurchasesCost)}
                            </td>
                            <td className="px-3 py-2 text-right">{formatINR(m.feedCost)}</td>
                            <td className="px-3 py-2 text-right">
                              {formatINR(m.mineralCost)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatINR(m.treatmentCost + m.maintenanceCost)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatINR(m.operatingExpensesCost)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatINR(m.totalExpenses)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-extrabold ${
                                m.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                              }`}
                            >
                              {formatINR(m.netProfit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: BATCH P&L */}
      {reportTab === "batches" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Per-Batch P&amp;L</CardTitle>
                <CardDescription>
                  Direct stocking, feed, and treatment costs compared against sales revenue per
                  batch.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsvFile(
                    "mudcrab-batch-pnl.csv",
                    [
                      "Batch",
                      "Purchased",
                      "Supplier",
                      "Crabs",
                      "Sold",
                      "Dead",
                      "Open",
                      "Stock Cost (INR)",
                      "Feed Cost (INR)",
                      "Treatment Cost (INR)",
                      "Revenue (INR)",
                      "Net Direct P&L (INR)",
                    ],
                    batchPnl.map((b) => [
                      b.letter,
                      b.purchaseDateLabel,
                      b.supplierName,
                      b.crabCount,
                      b.soldCount,
                      b.deadCount,
                      b.openCount,
                      b.totalPurchaseCost,
                      b.totalFeedCost,
                      b.totalTreatmentCost,
                      b.totalRevenue,
                      b.netDirectPnl,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {batchPnl.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">No batches found.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Batch</th>
                      <th className="px-3 py-2.5 font-semibold">Supplier</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Counts</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Stock ₹</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Feed + Tx ₹</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Sales ₹</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Direct P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batchPnl.map((b) => (
                      <tr key={b.id}>
                        <td className="px-3 py-2">
                          <Link
                            href={`/crabs?batch=${b.letter}`}
                            className="font-mono font-extrabold text-teal-800 hover:underline"
                          >
                            Batch {b.letter}
                          </Link>
                          <div className="text-[11px] text-slate-500">
                            {b.purchaseDateLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2">{b.supplierName}</td>
                        <td className="px-3 py-2 text-right text-xs">
                          {b.soldCount}S / {b.deadCount}D / {b.openCount}O
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(b.totalPurchaseCost)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(b.totalFeedCost + b.totalTreatmentCost)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatINR(b.totalRevenue)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-extrabold ${
                            b.netDirectPnl >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {formatINR(b.netDirectPnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: CRAB P&L */}
      {reportTab === "crabs" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base">Per-Crab P&amp;L &amp; Growth</CardTitle>
                <CardDescription>
                  Individual FCR, weight gain, costs, and realized profit.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Filter crab P&L status"
                  value={crabStatusFilter}
                  onChange={(e) => setCrabStatusFilter(e.target.value)}
                  className="w-36"
                >
                  <option value="ALL">All ({crabPnl.length})</option>
                  <option value="SOLD">SOLD</option>
                  <option value="DEAD">DEAD</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SICK">SICK</option>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsvFile(
                      "mudcrab-crab-pnl.csv",
                      [
                        "Code",
                        "Batch",
                        "Status",
                        "Days",
                        "Initial (g)",
                        "Latest (g)",
                        "Gain (g)",
                        "Growth (g/day)",
                        "Total Feed (g)",
                        "FCR",
                        "Purchase (INR)",
                        "Feed (INR)",
                        "Treatment (INR)",
                        "Sale (INR)",
                        "Profit (INR)",
                      ],
                      filteredCrabs.map((c) => [
                        c.code,
                        c.batchLetter,
                        c.status,
                        c.daysInSystem,
                        c.initialWeightG,
                        c.latestWeightG,
                        c.weightGainG,
                        c.growthGPerDay,
                        c.totalFeedG,
                        c.fcr ?? "",
                        c.purchaseCost,
                        c.feedCost,
                        c.treatmentCost,
                        c.saleAmount ?? "",
                        c.profit ?? "",
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCrabs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">
                No crabs match this status.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Crab</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Days</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Gain</th>
                      <th className="px-3 py-2.5 font-semibold text-right">FCR</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Costs ₹</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Sale ₹</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Profit ₹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCrabs.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono font-bold">
                          <Link
                            href={`/crabs/${c.id}`}
                            className="text-teal-800 hover:underline"
                          >
                            {c.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              c.status === "SICK" || c.status === "DEAD"
                                ? "danger"
                                : c.status === "SOLD"
                                ? "success"
                                : "teal"
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{c.daysInSystem} d</td>
                        <td className="px-3 py-2 text-right">
                          {c.weightGainG >= 0 ? "+" : ""}
                          {formatNumberIN(c.weightGainG, 0)} g
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.fcr !== null ? formatNumberIN(c.fcr, 2) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(c.purchaseCost + c.feedCost + c.treatmentCost)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.saleAmount !== null ? formatINR(c.saleAmount) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-extrabold ${
                            c.profit === null
                              ? "text-slate-400"
                              : c.profit >= 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {c.profit !== null ? formatINR(c.profit) : "In cycle"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: TRAY LIFETIME SUMMARY */}
      {reportTab === "trays" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Tray Lifetime Summary</CardTitle>
                <CardDescription>
                  Total crabs housed and realized profit from crabs ending in each tray.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsvFile(
                    "mudcrab-tray-pnl.csv",
                    [
                      "Tray",
                      "Active",
                      "Treatment Tray",
                      "Current Crab",
                      "Total Stays",
                      "Sold",
                      "Dead",
                      "Realized Profit (INR)",
                    ],
                    traySummary.map((t) => [
                      t.trayNumber,
                      t.active ? "Yes" : "No",
                      t.isTreatmentTray ? "Yes" : "No",
                      t.currentCrabCode ?? "",
                      t.staysCount,
                      t.soldCount,
                      t.deadCount,
                      t.realizedProfit,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Tray</th>
                    <th className="px-3 py-2.5 font-semibold">Current</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Stays</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Sold</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Dead</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Realized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {traySummary.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-mono font-bold">
                        <Link
                          href={`/trays/${t.id}`}
                          className="text-teal-800 hover:underline"
                        >
                          Tray {t.trayNumber}
                        </Link>
                        {t.isTreatmentTray && (
                          <span className="ml-2 text-[11px] font-sans text-red-700">
                            (Tx)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {t.currentCrabCode ?? (
                          <span className="text-slate-400 font-sans">EMPTY</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{t.staysCount}</td>
                      <td className="px-3 py-2 text-right">{t.soldCount}</td>
                      <td className="px-3 py-2 text-right">{t.deadCount}</td>
                      <td
                        className={`px-3 py-2 text-right font-extrabold ${
                          t.realizedProfit >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatINR(t.realizedProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

