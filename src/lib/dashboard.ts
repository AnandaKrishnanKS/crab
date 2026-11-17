import { diffCalendarDaysIST, formatChemicalFormula, formatDateIN, formatINR } from "./format";

export type IndicatorLevel = "green" | "amber" | "red";

export interface DashboardThresholds {
  waterTestIntervalDays: number;
  waterChangeWarnDays: number;
  waterChangeIntervalDays: number;
  salinityMin: number;
  salinityMax: number;
  phMin: number;
  phMax: number;
  ammoniaMax: number;
  nitriteMax: number;
  nitrateMax: number;
  tempMin: number;
  tempMax: number;
  targetFatteningDays: number;
  lowMineralStockKg: number;
  softCrabAlert: boolean;
}

export interface LatestWaterTestValues {
  dateTime: Date;
  salinityPpt: number | null;
  pH: number | null;
  ammoniaMgL: number | null;
  nitriteMgL: number | null;
  nitrateMgL: number | null;
  alkalinityMgL: number | null;
  temperatureC: number | null;
  dissolvedOxygenMgL: number | null;
}

export interface ParameterReadingStatus {
  key: string;
  label: string;
  valueText: string;
  level: IndicatorLevel;
  statusText: string;
}

function evalRange(
  val: number,
  min: number,
  max: number,
  nearMargin: number
): { level: IndicatorLevel; statusText: string } {
  if (val >= min && val <= max) {
    return { level: "green", statusText: "OK" };
  }
  if (val >= min - nearMargin && val <= max + nearMargin) {
    return { level: "amber", statusText: val < min ? "Slightly Low" : "Slightly High" };
  }
  return { level: "red", statusText: val < min ? "Low" : "High" };
}

function evalMax(
  val: number,
  max: number,
  amberRatio = 0.7
): { level: IndicatorLevel; statusText: string } {
  if (val > max) return { level: "red", statusText: "High" };
  if (val > max * amberRatio) return { level: "amber", statusText: "Elevated" };
  return { level: "green", statusText: "OK" };
}

export function evaluateWaterParameters(
  test: LatestWaterTestValues | null,
  thresholds: DashboardThresholds
): ParameterReadingStatus[] {
  if (!test) return [];
  const items: ParameterReadingStatus[] = [];

  if (test.salinityPpt !== null) {
    const s = evalRange(test.salinityPpt, thresholds.salinityMin, thresholds.salinityMax, 2);
    items.push({
      key: "salinity",
      label: "Salinity",
      valueText: `${test.salinityPpt} ppt`,
      ...s,
    });
  }
  if (test.pH !== null) {
    const s = evalRange(test.pH, thresholds.phMin, thresholds.phMax, 0.2);
    items.push({
      key: "pH",
      label: "pH",
      valueText: `${test.pH}`,
      ...s,
    });
  }
  if (test.ammoniaMgL !== null) {
    const s = evalMax(test.ammoniaMgL, thresholds.ammoniaMax);
    items.push({
      key: "ammonia",
      label: "NH₃",
      valueText: `${test.ammoniaMgL} mg/L`,
      ...s,
    });
  }
  if (test.nitriteMgL !== null) {
    const s = evalMax(test.nitriteMgL, thresholds.nitriteMax);
    items.push({
      key: "nitrite",
      label: "NO₂",
      valueText: `${test.nitriteMgL} mg/L`,
      ...s,
    });
  }
  if (test.nitrateMgL !== null) {
    const s = evalMax(test.nitrateMgL, thresholds.nitrateMax, 0.8);
    items.push({
      key: "nitrate",
      label: "NO₃",
      valueText: `${test.nitrateMgL} mg/L`,
      ...s,
    });
  }
  if (test.temperatureC !== null) {
    const s = evalRange(test.temperatureC, thresholds.tempMin, thresholds.tempMax, 1.5);
    items.push({
      key: "temp",
      label: "Temp",
      valueText: `${test.temperatureC} °C`,
      ...s,
    });
  }
  if (test.alkalinityMgL !== null) {
    items.push({
      key: "alkalinity",
      label: "Alkalinity",
      valueText: `${test.alkalinityMgL} mg/L CaCO₃`,
      level: "green",
      statusText: "Logged",
    });
  }
  if (test.dissolvedOxygenMgL !== null) {
    items.push({
      key: "do",
      label: "DO",
      valueText: `${test.dissolvedOxygenMgL} mg/L`,
      level: test.dissolvedOxygenMgL < 4 ? "red" : test.dissolvedOxygenMgL < 5 ? "amber" : "green",
      statusText: test.dissolvedOxygenMgL < 4 ? "Low" : test.dissolvedOxygenMgL < 5 ? "Watch" : "OK",
    });
  }

  return items;
}

export interface WaterScheduleStatus {
  daysSinceTest: number | null;
  testStatus: IndicatorLevel;
  testStatusLabel: string;
  daysSinceChange: number | null;
  nextChangeDueDate: Date | null;
  changeStatus: IndicatorLevel;
  changeStatusLabel: string;
}

export function evaluateWaterSchedules(
  latestTestDate: Date | null,
  latestChangeDate: Date | null,
  thresholds: DashboardThresholds,
  now: Date = new Date()
): WaterScheduleStatus {
  const daysSinceTest = latestTestDate
    ? diffCalendarDaysIST(latestTestDate, now)
    : null;

  let testStatus: IndicatorLevel = "green";
  let testStatusLabel = "On schedule";
  if (daysSinceTest === null) {
    testStatus = "red";
    testStatusLabel = "No tests yet";
  } else if (daysSinceTest > thresholds.waterTestIntervalDays + 1) {
    testStatus = "red";
    testStatusLabel = "Overdue";
  } else if (daysSinceTest > thresholds.waterTestIntervalDays) {
    testStatus = "amber";
    testStatusLabel = "Due today";
  }

  const daysSinceChange = latestChangeDate
    ? diffCalendarDaysIST(latestChangeDate, now)
    : null;
  const nextChangeDueDate = latestChangeDate
    ? new Date(
        latestChangeDate.getTime() +
          thresholds.waterChangeIntervalDays * 24 * 60 * 60 * 1000
      )
    : null;

  let changeStatus: IndicatorLevel = "green";
  let changeStatusLabel = "On schedule";
  if (daysSinceChange === null) {
    changeStatus = "red";
    changeStatusLabel = "No water change logged";
  } else if (daysSinceChange >= thresholds.waterChangeIntervalDays) {
    changeStatus = "red";
    changeStatusLabel = "Overdue";
  } else if (daysSinceChange >= thresholds.waterChangeWarnDays) {
    changeStatus = "amber";
    changeStatusLabel = "Due soon";
  }

  return {
    daysSinceTest,
    testStatus,
    testStatusLabel,
    daysSinceChange,
    nextChangeDueDate,
    changeStatus,
    changeStatusLabel,
  };
}

export interface DashboardAlert {
  id: string;
  severity: "red" | "amber";
  category:
    | "WATER_TEST"
    | "WATER_PARAM"
    | "WATER_CHANGE"
    | "UNFED"
    | "OVERDUE_HARVEST"
    | "SOFT_MOLT"
    | "SICK"
    | "PENDING_PAYMENT"
    | "LOW_STOCK";
  title: string;
  detail: string;
  href: string;
}

export interface DashboardAlertInput {
  thresholds: DashboardThresholds;
  schedule: WaterScheduleStatus;
  paramStatuses: ParameterReadingStatus[];
  unfedActiveCrabs: Array<{ id: string; code: string; trayNumber: string | null }>;
  pastTargetCrabs: Array<{ id: string; code: string; daysInSystem: number }>;
  softOrMoltedCrabs: Array<{ id: string; code: string; stage: string }>;
  sickCrabs: Array<{ id: string; code: string; trayNumber: string | null }>;
  pendingSales: Array<{ id: string; crabId: string; crabCode: string; totalAmount: number; buyerName: string }>;
  lowStockMinerals: Array<{ id: string; name: string; formula: string; stockKg: number }>;
}

export function buildDashboardAlerts(input: DashboardAlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (input.schedule.testStatus !== "green") {
    alerts.push({
      id: "water-test-overdue",
      severity: input.schedule.testStatus === "red" ? "red" : "amber",
      category: "WATER_TEST",
      title:
        input.schedule.daysSinceTest === null
          ? "No RAS water tests logged"
          : `Water test ${input.schedule.testStatusLabel.toLowerCase()} (${input.schedule.daysSinceTest} d ago)`,
      detail: `Target interval: every ${input.thresholds.waterTestIntervalDays} day(s).`,
      href: "/daily#water-test",
    });
  }

  const badParams = input.paramStatuses.filter((p) => p.level !== "green");
  if (badParams.length > 0) {
    const hasRed = badParams.some((p) => p.level === "red");
    alerts.push({
      id: "water-params",
      severity: hasRed ? "red" : "amber",
      category: "WATER_PARAM",
      title: `Water parameters need attention (${badParams.length})`,
      detail: badParams
        .map((p) => `${p.label}: ${p.valueText} (${p.statusText})`)
        .join(" • "),
      href: "/water",
    });
  }

  if (input.schedule.changeStatus !== "green") {
    const dueStr = input.schedule.nextChangeDueDate
      ? formatDateIN(input.schedule.nextChangeDueDate)
      : "";
    alerts.push({
      id: "water-change-due",
      severity: input.schedule.changeStatus === "red" ? "red" : "amber",
      category: "WATER_CHANGE",
      title:
        input.schedule.daysSinceChange === null
          ? "No RAS water change recorded"
          : `Full water change ${input.schedule.changeStatusLabel.toLowerCase()} (${input.schedule.daysSinceChange} d since last)`,
      detail: dueStr
        ? `Target cycle ${input.thresholds.waterChangeIntervalDays} d (due ${dueStr}).`
        : "Log a water change to track mineral ratios.",
      href: "/water?tab=changes&new=1",
    });
  }

  if (input.unfedActiveCrabs.length > 0) {
    const preview = input.unfedActiveCrabs
      .slice(0, 6)
      .map((c) => `${c.code}${c.trayNumber ? ` (#${c.trayNumber})` : ""}`)
      .join(", ");
    alerts.push({
      id: "unfed-active",
      severity: "amber",
      category: "UNFED",
      title: `${input.unfedActiveCrabs.length} active crab(s) not fed today`,
      detail: `${preview}${
        input.unfedActiveCrabs.length > 6 ? " …" : ""
      } (SICK crabs skipped)`,
      href: "/daily#feed",
    });
  }

  if (input.sickCrabs.length > 0) {
    alerts.push({
      id: "sick-crabs",
      severity: "red",
      category: "SICK",
      title: `${input.sickCrabs.length} sick crab(s) under treatment`,
      detail: input.sickCrabs
        .map((c) => `${c.code}${c.trayNumber ? ` (Tray ${c.trayNumber})` : ""}`)
        .join(", "),
      href: input.sickCrabs.length === 1 ? `/crabs/${input.sickCrabs[0].id}` : "/crabs",
    });
  }

  if (input.thresholds.softCrabAlert && input.softOrMoltedCrabs.length > 0) {
    alerts.push({
      id: "soft-molted-crabs",
      severity: "amber",
      category: "SOFT_MOLT",
      title: `${input.softOrMoltedCrabs.length} crab(s) in SOFT / MOLTED stage`,
      detail: input.softOrMoltedCrabs
        .map((c) => `${c.code} (${c.stage})`)
        .join(", "),
      href:
        input.softOrMoltedCrabs.length === 1
          ? `/crabs/${input.softOrMoltedCrabs[0].id}`
          : "/crabs",
    });
  }

  if (input.pastTargetCrabs.length > 0) {
    alerts.push({
      id: "past-target-days",
      severity: "amber",
      category: "OVERDUE_HARVEST",
      title: `${input.pastTargetCrabs.length} crab(s) past ${input.thresholds.targetFatteningDays}d target`,
      detail: input.pastTargetCrabs
        .slice(0, 5)
        .map((c) => `${c.code} (${c.daysInSystem} d)`)
        .join(", "),
      href: "/crabs",
    });
  }

  if (input.pendingSales.length > 0) {
    const pendingSum = input.pendingSales.reduce((s, p) => s + p.totalAmount, 0);
    alerts.push({
      id: "pending-payments",
      severity: "amber",
      category: "PENDING_PAYMENT",
      title: `${input.pendingSales.length} pending sale payment(s) (${formatINR(pendingSum)})`,
      detail: input.pendingSales
        .slice(0, 4)
        .map((p) => `${p.crabCode} — ${p.buyerName} (${formatINR(p.totalAmount)})`)
        .join(" • "),
      href: "/reports",
    });
  }

  if (input.lowStockMinerals.length > 0) {
    alerts.push({
      id: "low-mineral-stock",
      severity: "amber",
      category: "LOW_STOCK",
      title: `${input.lowStockMinerals.length} chemical(s) low on stock (≤ ${input.thresholds.lowMineralStockKg} kg)`,
      detail: input.lowStockMinerals
        .map(
          (m) =>
            `${m.name} (${formatChemicalFormula(m.formula)}): ${m.stockKg} kg`
        )
        .join(" • "),
      href: "/water?tab=chemicals",
    });
  }

  return alerts;
}

