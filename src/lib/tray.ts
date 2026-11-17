import { computeCrabMetrics, type CrabMetricsInput } from "./crab-metrics";
import { diffCalendarDaysIST } from "./format";

export type TrayOutcome = "CURRENT" | "CURRENT_SICK" | "MOVED" | "SOLD" | "DEAD";

export interface TrayAssignmentHistoryInput {
  id: string;
  fromDate: Date;
  toDate: Date | null;
  reason: "STOCKED" | "MOVED_TO_TREATMENT" | "MOVED_BACK" | "MOVED_OTHER";
  hasLaterAssignment: boolean;
  crab: CrabMetricsInput & {
    id: string;
    code: string;
    currentTrayId: string | null;
  };
}

export interface TrayHistoryRow {
  assignmentId: string;
  crabId: string;
  crabCode: string;
  fromDate: Date;
  toDate: Date | null;
  days: number;
  initialWeightG: number;
  finalWeightG: number;
  gainG: number;
  outcome: TrayOutcome;
  profit: number | null;
  reason: TrayAssignmentHistoryInput["reason"];
}

export function determineTrayOutcome(
  assignment: Pick<TrayAssignmentHistoryInput, "toDate" | "hasLaterAssignment">,
  crab: Pick<TrayAssignmentHistoryInput["crab"], "status" | "currentTrayId">
): TrayOutcome {
  if (assignment.toDate === null) {
    return crab.status === "SICK" ? "CURRENT_SICK" : "CURRENT";
  }
  if (crab.currentTrayId !== null || assignment.hasLaterAssignment) {
    return "MOVED";
  }
  if (crab.status === "SOLD") return "SOLD";
  if (crab.status === "DEAD") return "DEAD";
  return "MOVED";
}

export function buildTrayHistoryRows(
  assignments: TrayAssignmentHistoryInput[],
  now: Date = new Date()
): TrayHistoryRow[] {
  return assignments.map((a) => {
    const metrics = computeCrabMetrics(a.crab, now);
    const outcome = determineTrayOutcome(a, a.crab);
    const days = diffCalendarDaysIST(a.fromDate, a.toDate ?? now);
    const realizedProfit =
      outcome === "SOLD" || outcome === "DEAD" ? metrics.profit : null;

    return {
      assignmentId: a.id,
      crabId: a.crab.id,
      crabCode: a.crab.code,
      fromDate: a.fromDate,
      toDate: a.toDate,
      days,
      initialWeightG: a.crab.initialWeightG,
      finalWeightG: metrics.latestWeightG,
      gainG: metrics.weightGainG,
      outcome,
      profit: realizedProfit,
      reason: a.reason,
    };
  });
}

