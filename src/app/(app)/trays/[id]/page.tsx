import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { buildCrabActionContext } from "@/lib/crab-context";
import { computeCrabMetrics } from "@/lib/crab-metrics";
import { buildTrayHistoryRows } from "@/lib/tray";
import {
  formatDateIN,
  formatINR,
  formatNumberIN,
} from "@/lib/format";
import { CrabActionModals } from "@/components/crab-action-modals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TrayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tray = await db.tray.findUnique({
    where: { id },
    include: {
      currentCrab: {
        include: {
          batch: { select: { letter: true } },
          weightLogs: { select: { date: true, weightG: true } },
          moltLogs: { orderBy: { date: "desc" } },
          feedLogs: { orderBy: { dateTime: "desc" } },
          treatmentLogs: { select: { cost: true } },
          sale: { select: { totalAmount: true } },
        },
      },
      assignments: {
        orderBy: { fromDate: "desc" },
        include: {
          crab: {
            include: {
              assignments: { select: { id: true, fromDate: true } },
              weightLogs: { select: { date: true, weightG: true } },
              moltLogs: { select: { date: true, stage: true, weightAfterG: true } },
              feedLogs: { select: { quantityG: true, costAtTime: true } },
              treatmentLogs: { select: { cost: true } },
              sale: { select: { totalAmount: true } },
            },
          },
        },
      },
    },
  });

  if (!tray) {
    notFound();
  }

  const now = new Date();
  const currentContext = tray.currentCrab
    ? await buildCrabActionContext(tray.currentCrab.id)
    : null;
  const currentMetrics = tray.currentCrab
    ? computeCrabMetrics(tray.currentCrab, now)
    : null;

  const historyRows = buildTrayHistoryRows(
    tray.assignments.map((a) => ({
      id: a.id,
      fromDate: a.fromDate,
      toDate: a.toDate,
      reason: a.reason,
      hasLaterAssignment: a.crab.assignments.some(
        (other) => other.fromDate.getTime() > a.fromDate.getTime()
      ),
      crab: a.crab,
    })),
    now
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Link
          href="/trays"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Trays
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Tray <span className="font-mono">{tray.number}</span>
          </h1>
          <Badge
            variant={
              tray.currentCrab?.status === "SICK"
                ? "danger"
                : tray.currentCrab
                ? "teal"
                : "default"
            }
          >
            {tray.currentCrab ? "OCCUPIED" : "EMPTY"}
          </Badge>
          {tray.isTreatmentTray && (
            <Badge variant="warning">
              <ShieldAlert className="h-3 w-3" />
              Treatment tray
            </Badge>
          )}
          {!tray.active && <Badge variant="default">Inactive</Badge>}
        </div>
        {tray.notes && <p className="text-sm text-slate-600">{tray.notes}</p>}
      </div>

      {tray.currentCrab && currentMetrics && currentContext ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>Current Crab:</span>
                  <Link
                    href={`/crabs/${tray.currentCrab.id}`}
                    className="font-mono text-teal-800 underline underline-offset-2"
                  >
                    {tray.currentCrab.code}
                  </Link>
                  <Badge
                    variant={
                      tray.currentCrab.status === "SICK" ? "danger" : "teal"
                    }
                  >
                    {tray.currentCrab.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Batch {tray.currentCrab.batch.letter} • {tray.currentCrab.sex} •{" "}
                  {currentMetrics.daysInSystem} d in RAS •{" "}
                  {formatNumberIN(currentMetrics.latestWeightG, 0)} g (
                  {currentMetrics.weightGainG >= 0 ? "+" : ""}
                  {formatNumberIN(currentMetrics.weightGainG, 0)} g gain)
                </CardDescription>
              </div>
              <Link
                href={`/crabs/${tray.currentCrab.id}`}
                className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Full Crab Profile →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <span>
                Last feed:{" "}
                <strong className="text-slate-900">
                  {tray.currentCrab.feedLogs[0]
                    ? `${formatNumberIN(tray.currentCrab.feedLogs[0].quantityG, 0)} g (${formatDateIN(
                        tray.currentCrab.feedLogs[0].dateTime
                      )})`
                    : "None yet"}
                </strong>
              </span>
              <span>
                Last molt:{" "}
                <strong className="text-slate-900">
                  {tray.currentCrab.moltLogs[0]
                    ? `${tray.currentCrab.moltLogs[0].stage} (${formatDateIN(
                        tray.currentCrab.moltLogs[0].date
                      )})`
                    : "None logged"}
                </strong>
              </span>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <CrabActionModals data={currentContext} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tray {tray.number} is EMPTY
              </h2>
              <p className="text-sm text-slate-600">
                {tray.active
                  ? "Ready to hold a new crab from a batch or an in-system move."
                  : "This tray is marked inactive."}
              </p>
            </div>
            {tray.active && (
              <Link
                href={`/batches/new?trayId=${tray.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Stock New Batch Here
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Crabs in Tray {tray.number} ({historyRows.length})
          </CardTitle>
          <CardDescription>
            Previous crabs in this tray and current occupancy; history never disappears on reuse.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {historyRows.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-600">
              No crabs have been placed in Tray {tray.number} yet.
            </p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Crab</th>
                  <th className="px-3 py-2.5 font-semibold">From</th>
                  <th className="px-3 py-2.5 font-semibold">To</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Days</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Init</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Final</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Gain</th>
                  <th className="px-3 py-2.5 font-semibold">Outcome</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyRows.map((row) => (
                  <tr key={row.assignmentId} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                      <Link
                        href={`/crabs/${row.crabId}`}
                        className="text-teal-800 underline underline-offset-2"
                      >
                        {row.crabCode}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {formatDateIN(row.fromDate)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {row.toDate ? formatDateIN(row.toDate) : "Present"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">
                      {row.days} d
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">
                      {formatNumberIN(row.initialWeightG, 0)} g
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-900 font-semibold whitespace-nowrap">
                      {formatNumberIN(row.finalWeightG, 0)} g
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">
                      {row.gainG >= 0 ? "+" : ""}
                      {formatNumberIN(row.gainG, 0)} g
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge
                        variant={
                          row.outcome === "SOLD"
                            ? "success"
                            : row.outcome === "CURRENT_SICK"
                            ? "danger"
                            : row.outcome === "CURRENT"
                            ? "teal"
                            : "default"
                        }
                      >
                        {row.outcome === "CURRENT_SICK" ? "SICK (CUR)" : row.outcome}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                      {row.profit !== null ? (
                        <span
                          className={
                            row.profit >= 0 ? "text-emerald-700" : "text-red-700"
                          }
                        >
                          {formatINR(row.profit)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

