import { describe, expect, it } from "vitest";
import { formatCrabCode, indexToBatchLetter, previewBatchCodes } from "../batch";
import { computeCrabMetrics, computeCrabProfit } from "../crab-metrics";
import { buildTrayHistoryRows } from "../tray";
import {
  buildDashboardAlerts,
  evaluateWaterParameters,
  evaluateWaterSchedules,
  type DashboardThresholds,
} from "../dashboard";
import { computePeriodFinancials } from "../finance";
import {
  formatChemicalFormula,
  formatDateIN,
  formatINR,
  formatMineralQuantityG,
  normalizeTrayNumber,
} from "../format";
import {
  calculateChemicalDoses,
  computeAddedIonsMg,
  computeWaterRatios,
  type MineralDefinition,
} from "../water";

import {
  buildBatchPnlRows,
  buildCrabPnlRows,
  buildMonthlyPnlSeries,
  buildTraySummaryRows,
  computeFarmKPIs,
  escapeCsvCell,
  toCsv,
} from "../reports";

describe("batch and crab code generation", () => {
  it("converts batch indices to A..Z, AA..ZZ", () => {
    expect(indexToBatchLetter(0)).toBe("A");
    expect(indexToBatchLetter(1)).toBe("B");
    expect(indexToBatchLetter(25)).toBe("Z");
    expect(indexToBatchLetter(26)).toBe("AA");
    expect(indexToBatchLetter(27)).toBe("AB");
    expect(indexToBatchLetter(51)).toBe("AZ");
    expect(indexToBatchLetter(52)).toBe("BA");
    expect(indexToBatchLetter(701)).toBe("ZZ");
    expect(indexToBatchLetter(702)).toBe("AAA");
  });

  it("formats crab codes in lowercase", () => {
    expect(formatCrabCode("A", 1)).toBe("a1");
    expect(formatCrabCode("AA", 12)).toBe("aa12");
    expect(previewBatchCodes("C", 1, 3)).toEqual(["c1", "c2", "c3"]);
    expect(previewBatchCodes("B", 4, 2)).toEqual(["b4", "b5"]);
  });
});

describe("Indian formatting and tray numbering", () => {
  it("formats INR with Indian digit grouping", () => {
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(1250.5)).toBe("₹1,250.50");
  });

  it("formats dates in DD/MM/YYYY Asia/Kolkata", () => {
    // 2026-11-11T20:00:00Z is 2026-11-12T01:30:00+05:30
    expect(formatDateIN(new Date("2026-11-11T20:00:00.000Z"))).toBe("12/11/2026");
  });

  it("normalizes tray numbers with zero-padding up to 99 and 100+", () => {
    expect(normalizeTrayNumber("1")).toBe("01");
    expect(normalizeTrayNumber("09")).toBe("09");
    expect(normalizeTrayNumber("12")).toBe("12");
    expect(normalizeTrayNumber("100")).toBe("100");
    expect(normalizeTrayNumber("105")).toBe("105");
  });

  it("formats chemical formulas with subscripts and centered hydrate dot", () => {
    expect(formatChemicalFormula("NaCl")).toBe("NaCl");
    expect(formatChemicalFormula("MgCl2.6H2O")).toBe("MgCl₂·6H₂O");
    expect(formatChemicalFormula("MgSO4.7H2O")).toBe("MgSO₄·7H₂O");
    expect(formatChemicalFormula("CaCl2.2H2O")).toBe("CaCl₂·2H₂O");
    expect(formatChemicalFormula("NaHCO3")).toBe("NaHCO₃");
  });

  it("formats mineral quantity in kg above 1000 g", () => {
    expect(formatMineralQuantityG(916)).toBe("916 g");
    expect(formatMineralQuantityG(1000)).toBe("1,000 g");
    expect(formatMineralQuantityG(1250)).toBe("1.25 kg");
  });
});

describe("crab metrics and profit calculations", () => {
  it("computes profit for sold crabs and loss for dead crabs", () => {
    expect(
      computeCrabProfit({
        status: "SOLD",
        purchaseCost: 400,
        feedCost: 150,
        treatmentCost: 50,
        saleAmount: 1100,
      })
    ).toBe(500);

    expect(
      computeCrabProfit({
        status: "DEAD",
        purchaseCost: 400,
        feedCost: 120,
        treatmentCost: 80,
        saleAmount: null,
      })
    ).toBe(-600);

    expect(
      computeCrabProfit({
        status: "ACTIVE",
        purchaseCost: 400,
        feedCost: 100,
        treatmentCost: 0,
        saleAmount: null,
      })
    ).toBeNull();
  });

  it("computes growth, feed totals, and FCR", () => {
    const metrics = computeCrabMetrics(
      {
        initialWeightG: 400,
        finalWeightG: null,
        purchaseCost: "450.00",
        stockedDate: new Date("2026-10-01T06:30:00.000Z"),
        endDate: null,
        status: "ACTIVE",
        weightLogs: [{ date: new Date("2026-10-16T06:30:00.000Z"), weightG: 550 }],
        moltLogs: [],
        feedLogs: [
          { quantityG: 150, costAtTime: "30.00" },
          { quantityG: 150, costAtTime: "30.00" },
        ],
        treatmentLogs: [{ cost: "25.00" }],
        sale: null,
      },
      new Date("2026-10-21T06:30:00.000Z")
    );

    expect(metrics.daysInSystem).toBe(20);
    expect(metrics.latestWeightG).toBe(550);
    expect(metrics.weightGainG).toBe(150);
    expect(metrics.growthGPerDay).toBe(7.5);
    expect(metrics.totalFeedG).toBe(300);
    expect(metrics.feedCost).toBe(60);
    expect(metrics.treatmentCost).toBe(25);
    expect(metrics.fcr).toBe(2);
    expect(metrics.profit).toBeNull();
  });
});

describe("water ratios, ion additions, and dose calculator", () => {
  const minerals: MineralDefinition[] = [
    {
      id: "1",
      name: "Sodium chloride",
      formula: "NaCl",
      purpose: "SALINITY",
      costPerKg: 20,
      naFraction: 0.393,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.607,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "2",
      name: "Magnesium chloride",
      formula: "MgCl2.6H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 80,
      naFraction: 0,
      mgFraction: 0.12,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.349,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "3",
      name: "Magnesium sulphate",
      formula: "MgSO4.7H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 60,
      naFraction: 0,
      mgFraction: 0.099,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0.39,
      hco3Fraction: 0,
    },
    {
      id: "4",
      name: "Calcium chloride",
      formula: "CaCl2.2H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 90,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0.273,
      kFraction: 0,
      clFraction: 0.482,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "5",
      name: "Potassium chloride",
      formula: "KCl",
      purpose: "MINERAL_BALANCE",
      costPerKg: 120,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0.524,
      clFraction: 0.476,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "6",
      name: "Sodium bicarbonate",
      formula: "NaHCO3",
      purpose: "PH_BUFFER",
      costPerKg: 70,
      naFraction: 0.274,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0,
      hco3Fraction: 0.726,
    },
  ];

  it("computes Mg:Ca, Na:K, and Ca:K mineral ratios", () => {
    const ratios = computeWaterRatios({
      calciumMgL: 250,
      magnesiumMgL: 750,
      potassiumMgL: 200,
      sodiumMgL: 5600,
    });
    expect(ratios.mgToCa).toBe(3);
    expect(ratios.naToK).toBe(28);
    expect(ratios.caToK).toBe(1.25);
  });

  it("computes added ions in mg from quantity and fractions", () => {
    const ions = computeAddedIonsMg(1000, minerals[3]); // 1000g CaCl2.2H2O
    expect(ions.caMg).toBe(273000);
    expect(ions.clMg).toBe(482000);
    expect(ions.mgMg).toBe(0);
  });

  it("matches the spec dose example for CaCl2.2H2O (~916 g for +50 mg/L Ca in 5000 L)", () => {
    const result = calculateChemicalDoses(
      {
        systemVolumeLitres: 5000,
        currentCaMgL: 200,
        targetCaMgL: 250,
      },
      minerals
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].formula).toBe("CaCl2.2H2O");
    expect(Math.round(result.items[0].grams)).toBe(916);
  });
});

describe("tray assignment history rules", () => {
  it("classifies SOLD, DEAD, intermediate MOVED (profit null), and CURRENT_SICK rows", () => {
    const t0 = new Date("2026-09-01T09:00:00+05:30");
    const t1 = new Date("2026-09-11T09:00:00+05:30");
    const t2 = new Date("2026-09-21T09:00:00+05:30");

    const rows = buildTrayHistoryRows(
      [
        {
          id: "assign-moved",
          fromDate: t0,
          toDate: t1,
          reason: "STOCKED",
          hasLaterAssignment: true,
          crab: {
            id: "c-moved",
            code: "a1",
            initialWeightG: 400,
            finalWeightG: 500,
            purchaseCost: 300,
            stockedDate: t0,
            endDate: t2,
            status: "SOLD",
            currentTrayId: null,
            weightLogs: [],
            moltLogs: [],
            feedLogs: [{ quantityG: 100, costAtTime: 50 }],
            treatmentLogs: [],
            sale: { totalAmount: 900 },
          },
        },
        {
          id: "assign-sold",
          fromDate: t1,
          toDate: t2,
          reason: "MOVED_BACK",
          hasLaterAssignment: false,
          crab: {
            id: "c-sold",
            code: "a1",
            initialWeightG: 400,
            finalWeightG: 500,
            purchaseCost: 300,
            stockedDate: t0,
            endDate: t2,
            status: "SOLD",
            currentTrayId: null,
            weightLogs: [],
            moltLogs: [],
            feedLogs: [{ quantityG: 100, costAtTime: 50 }],
            treatmentLogs: [],
            sale: { totalAmount: 900 },
          },
        },
        {
          id: "assign-sick",
          fromDate: t1,
          toDate: null,
          reason: "MOVED_TO_TREATMENT",
          hasLaterAssignment: false,
          crab: {
            id: "c-sick",
            code: "b8",
            initialWeightG: 420,
            finalWeightG: null,
            purchaseCost: 350,
            stockedDate: t0,
            endDate: null,
            status: "SICK",
            currentTrayId: "tray-12",
            weightLogs: [{ date: t1, weightG: 440 }],
            moltLogs: [],
            feedLogs: [],
            treatmentLogs: [{ cost: 40 }],
            sale: null,
          },
        },
      ],
      t2
    );

    expect(rows[0].outcome).toBe("MOVED");
    expect(rows[0].days).toBe(10);
    expect(rows[0].profit).toBeNull();

    expect(rows[1].outcome).toBe("SOLD");
    expect(rows[1].days).toBe(10);
    expect(rows[1].gainG).toBe(100);
    expect(rows[1].profit).toBe(550);

    expect(rows[2].outcome).toBe("CURRENT_SICK");
    expect(rows[2].days).toBe(10);
    expect(rows[2].finalWeightG).toBe(440);
    expect(rows[2].profit).toBeNull();
  });
});

describe("dashboard alerts, parameter evaluation & period finance", () => {
  const thresholds: DashboardThresholds = {
    waterTestIntervalDays: 1,
    waterChangeWarnDays: 90,
    waterChangeIntervalDays: 120,
    salinityMin: 18,
    salinityMax: 25,
    phMin: 7.6,
    phMax: 8.3,
    ammoniaMax: 0.25,
    nitriteMax: 0.25,
    nitrateMax: 40,
    tempMin: 26,
    tempMax: 31,
    targetFatteningDays: 45,
    lowMineralStockKg: 2,
    softCrabAlert: true,
  };

  it("evaluates water parameters and schedule thresholds properly", () => {
    const now = new Date("2026-11-12T06:00:00+05:30");
    const params = evaluateWaterParameters(
      {
        dateTime: now,
        salinityPpt: 20, // green
        pH: 7.45, // slightly low -> amber
        ammoniaMgL: 0.35, // high -> red
        nitriteMgL: 0.05, // green
        nitrateMgL: 25, // green
        alkalinityMgL: 130,
        temperatureC: 28,
        dissolvedOxygenMgL: 6.1,
      },
      thresholds
    );

    expect(params.find((p) => p.key === "salinity")?.level).toBe("green");
    expect(params.find((p) => p.key === "pH")?.level).toBe("amber");
    expect(params.find((p) => p.key === "ammonia")?.level).toBe("red");

    const scheduleWarn = evaluateWaterSchedules(
      new Date("2026-11-11T07:00:00+05:30"),
      new Date("2026-08-10T07:00:00+05:30"), // 94 days ago -> amber (>= 90, < 120)
      thresholds,
      now
    );
    expect(scheduleWarn.testStatus).toBe("green");
    expect(scheduleWarn.changeStatus).toBe("amber");

    const scheduleRed = evaluateWaterSchedules(
      new Date("2026-11-08T07:00:00+05:30"), // 4 days ago -> red (> 2)
      new Date("2026-07-01T07:00:00+05:30"), // > 120d -> red
      thresholds,
      now
    );
    expect(scheduleRed.testStatus).toBe("red");
    expect(scheduleRed.changeStatus).toBe("red");
  });

  it("builds dashboard alerts respecting softCrabAlert and SICK exclusion from unfed", () => {
    const now = new Date("2026-11-12T06:00:00+05:30");
    const schedule = evaluateWaterSchedules(now, now, thresholds, now);
    const alerts = buildDashboardAlerts({
      thresholds,
      schedule,
      paramStatuses: [],
      unfedActiveCrabs: [{ id: "c1", code: "b1", trayNumber: "01" }],
      pastTargetCrabs: [{ id: "c2", code: "b2", daysInSystem: 48 }],
      softOrMoltedCrabs: [{ id: "c3", code: "b3", stage: "SOFT" }],
      sickCrabs: [{ id: "c4", code: "b8", trayNumber: "12" }],
      pendingSales: [
        {
          id: "s1",
          crabId: "c5",
          crabCode: "a2",
          totalAmount: 1450,
          buyerName: "Chennai Live Exports",
        },
      ],
      lowStockMinerals: [
        { id: "m1", name: "Potassium chloride", formula: "KCl", stockKg: 1.5 },
      ],
    });

    expect(alerts.map((a) => a.category)).toEqual([
      "UNFED",
      "SICK",
      "SOFT_MOLT",
      "OVERDUE_HARVEST",
      "PENDING_PAYMENT",
      "LOW_STOCK",
    ]);

    const mutedSoftAlerts = buildDashboardAlerts({
      thresholds: { ...thresholds, softCrabAlert: false },
      schedule,
      paramStatuses: [],
      unfedActiveCrabs: [],
      pastTargetCrabs: [],
      softOrMoltedCrabs: [{ id: "c3", code: "b3", stage: "SOFT" }],
      sickCrabs: [],
      pendingSales: [],
      lowStockMinerals: [],
    });
    expect(mutedSoftAlerts).toHaveLength(0);
  });

  it("computes non-double-counted period financials cleanly", () => {
    const summary = computePeriodFinancials({
      sales: [{ totalAmount: 5000 }, { totalAmount: 2250.5 }],
      crabPurchases: [{ purchaseCost: 2400 }],
      feedLogs: [{ costAtTime: 350.25 }, { costAtTime: 149.75 }],
      treatmentLogs: [{ cost: 120 }],
      mineralAdditions: [{ costAtTime: 480 }],
      systemLogs: [{ cost: 200 }, { cost: null }],
      expenses: [{ amount: 1500 }],
    });

    expect(summary.salesRevenue).toBe(7250.5);
    expect(summary.totalExpenses).toBe(5200);
    expect(summary.netProfit).toBe(2050.5);
  });
});

describe("reports, P&L rollups, and CSV escaping", () => {
  it("escapes CSV cells containing quotes, commas, or newlines", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell('Chennai, "Live"')).toBe('"Chennai, ""Live"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');

    const csv = toCsv(
      ["Code", "Notes", "Amount"],
      [
        ["a1", 'Sold, "Grade A"', 1450],
        ["b2", null, 0],
      ]
    );
    expect(csv).toBe('Code,Notes,Amount\r\na1,"Sold, ""Grade A""",1450\r\nb2,,0');
  });

  it("builds monthly P&L buckets in Asia/Kolkata without double counting", () => {
    const series = buildMonthlyPnlSeries({
      sales: [
        { date: new Date("2026-10-31T20:00:00.000Z"), totalAmount: 2000 }, // 2026-11-01 01:30 IST
        { date: new Date("2026-10-15T10:00:00.000Z"), totalAmount: 3000 }, // 2026-10 IST
      ],
      crabPurchases: [{ stockedDate: new Date("2026-10-02T05:00:00.000Z"), purchaseCost: 1200 }],
      feedLogs: [{ dateTime: new Date("2026-11-02T05:00:00.000Z"), costAtTime: 150 }],
      treatmentLogs: [{ date: new Date("2026-10-10T05:00:00.000Z"), cost: 100 }],
      mineralAdditions: [{ dateTime: new Date("2026-11-03T05:00:00.000Z"), costAtTime: 250 }],
      systemLogs: [
        { date: new Date("2026-11-04T05:00:00.000Z"), cost: 300 },
        { date: new Date("2026-11-05T05:00:00.000Z"), cost: null },
      ],
      expenses: [{ date: new Date("2026-10-20T05:00:00.000Z"), amount: 500 }],
    });

    expect(series.map((r) => r.ymKey)).toEqual(["2026-10", "2026-11"]);
    expect(series[0].salesRevenue).toBe(3000);
    expect(series[0].totalExpenses).toBe(1800); // 1200 + 100 + 500
    expect(series[0].netProfit).toBe(1200);
    expect(series[1].salesRevenue).toBe(2000);
    expect(series[1].totalExpenses).toBe(700); // 150 + 250 + 300
    expect(series[1].netProfit).toBe(1300);
  });

  it("computes crab/batch/tray P&L rollups and farm KPIs accurately", () => {
    const stocked = new Date("2026-10-01T00:00:00+05:30");
    const soldEnd = new Date("2026-10-11T00:00:00+05:30");
    const now = new Date("2026-10-21T00:00:00+05:30");

    const crabs = [
      {
        id: "c1",
        code: "a1",
        batchId: "batch-a",
        batchLetter: "A",
        sex: "FEMALE" as const,
        initialWeightG: 400,
        finalWeightG: 500,
        purchaseCost: 600,
        stockedDate: stocked,
        endDate: soldEnd,
        status: "SOLD" as const,
        currentTrayId: null,
        weightLogs: [{ date: soldEnd, weightG: 500 }],
        moltLogs: [],
        feedLogs: [{ quantityG: 200, costAtTime: 50 }],
        treatmentLogs: [],
        sale: { totalAmount: 1400 },
      },
      {
        id: "c2",
        code: "a2",
        batchId: "batch-a",
        batchLetter: "A",
        sex: "MALE" as const,
        initialWeightG: 450,
        finalWeightG: 450,
        purchaseCost: 500,
        stockedDate: stocked,
        endDate: soldEnd,
        status: "DEAD" as const,
        currentTrayId: null,
        weightLogs: [],
        moltLogs: [],
        feedLogs: [{ quantityG: 100, costAtTime: 25 }],
        treatmentLogs: [{ cost: 75 }],
        sale: null,
      },
    ];

    const crabRows = buildCrabPnlRows(crabs, now);
    expect(crabRows[0].profit).toBe(750); // 1400 - (600 + 50)
    expect(crabRows[1].profit).toBe(-600); // -(500 + 25 + 75)

    const batches = buildBatchPnlRows(
      [
        {
          id: "batch-a",
          letter: "A",
          purchaseDate: stocked,
          supplierName: "Pulicat Landing",
          crabs,
        },
      ],
      now
    );
    expect(batches[0].soldCount).toBe(1);
    expect(batches[0].deadCount).toBe(1);
    expect(batches[0].netDirectPnl).toBe(150);

    const trays = buildTraySummaryRows(
      [
        {
          id: "t10",
          number: "10",
          active: true,
          isTreatmentTray: false,
          currentCrabCode: null,
          assignments: [
            {
              id: "as2",
              fromDate: stocked,
              toDate: soldEnd,
              reason: "STOCKED" as const,
              hasLaterAssignment: false,
              crab: crabs[1],
            },
          ],
        },
        {
          id: "t2",
          number: "02",
          active: true,
          isTreatmentTray: false,
          currentCrabCode: null,
          assignments: [
            {
              id: "as1",
              fromDate: stocked,
              toDate: soldEnd,
              reason: "STOCKED" as const,
              hasLaterAssignment: false,
              crab: crabs[0],
            },
          ],
        },
      ],
      now
    );
    expect(trays.map((t) => t.trayNumber)).toEqual(["02", "10"]);
    expect(trays[0].realizedProfit).toBe(750);
    expect(trays[1].realizedProfit).toBe(-600);

    const kpis = computeFarmKPIs(crabRows, [{ totalAmount: 1400 }]);
    expect(kpis.avgGrowthGPerDay).toBe(5); // (10 + 0) / 2
    expect(kpis.avgDaysToSale).toBe(10);
    expect(kpis.mortalityRatePct).toBe(50);
    expect(kpis.pendingPaymentsCount).toBe(1);
    expect(kpis.pendingPaymentsAmount).toBe(1400);
  });
});

describe("edge cases: dose calculator split/pH, latest weight priority & FCR guard, tray outcome", () => {
  const minerals: MineralDefinition[] = [
    {
      id: "1",
      name: "Sodium chloride",
      formula: "NaCl",
      purpose: "SALINITY",
      costPerKg: 20,
      naFraction: 0.393,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.607,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "2",
      name: "Magnesium chloride",
      formula: "MgCl2.6H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 80,
      naFraction: 0,
      mgFraction: 0.12,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.349,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "3",
      name: "Magnesium sulphate",
      formula: "MgSO4.7H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 60,
      naFraction: 0,
      mgFraction: 0.099,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0.39,
      hco3Fraction: 0,
    },
    {
      id: "4",
      name: "Calcium chloride",
      formula: "CaCl2.2H2O",
      purpose: "MINERAL_BALANCE",
      costPerKg: 90,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0.273,
      kFraction: 0,
      clFraction: 0.482,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "5",
      name: "Potassium chloride",
      formula: "KCl",
      purpose: "MINERAL_BALANCE",
      costPerKg: 120,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0.524,
      clFraction: 0.476,
      so4Fraction: 0,
      hco3Fraction: 0,
    },
    {
      id: "6",
      name: "Sodium bicarbonate",
      formula: "NaHCO3",
      purpose: "PH_BUFFER",
      costPerKg: 70,
      naFraction: 0.274,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0,
      hco3Fraction: 0.726,
    },
  ];

  it("calculates salinity (NaCl), 50/50 Mg split, KCl, alkalinity (CaCO3->HCO3), and ignores non-positive deltas", () => {
    const res = calculateChemicalDoses(
      {
        systemVolumeLitres: 5000,
        currentSalinityPpt: 18,
        targetSalinityPpt: 20, // +2 ppt = 2000 mg/L * 5000 L = 10,000 g NaCl
        currentMgMgL: 500,
        targetMgMgL: 600, // +100 mg/L Mg split 50/50 -> 50 each
        mgCl2SharePercent: 50,
        currentKMgL: 180,
        targetKMgL: 230, // +50 mg/L K
        alkalinityMode: "CACO3",
        currentAlkalinity: 100,
        targetAlkalinity: 120, // +20 mg/L CaCO3 => * 1.2192 HCO3
      },
      minerals
    );

    const byFormula = new Map(res.items.map((i) => [i.formula, i.grams]));
    expect(Math.round(byFormula.get("NaCl") ?? 0)).toBe(10000);
    // 50 mg/L * 5000 L = 250 g Mg -> 250 / 0.12 = 2083 g MgCl2.6H2O; 250 / 0.099 = 2525 g MgSO4.7H2O
    expect(Math.round(byFormula.get("MgCl2.6H2O") ?? 0)).toBe(2083);
    expect(Math.round(byFormula.get("MgSO4.7H2O") ?? 0)).toBe(2525);
    // 50 * 5000 / 1000 / 0.524 = 477 g KCl
    expect(Math.round(byFormula.get("KCl") ?? 0)).toBe(477);
    // 20 * 1.2192 * 5000 / 1000 / 0.726 = 168 g NaHCO3
    expect(Math.round(byFormula.get("NaHCO3") ?? 0)).toBe(168);

    const noIncrease = calculateChemicalDoses(
      {
        systemVolumeLitres: 5000,
        currentSalinityPpt: 22,
        targetSalinityPpt: 20,
        currentCaMgL: 250,
        targetCaMgL: 250,
      },
      minerals
    );
    expect(noIncrease.items).toHaveLength(0);
  });

  it("prioritizes finalWeightG and newest weight/molt measurement, and sets FCR null when gain <= 0", () => {
    const t0 = new Date("2026-10-01T08:00:00+05:30");
    const t1 = new Date("2026-10-05T08:00:00+05:30");
    const t2 = new Date("2026-10-10T08:00:00+05:30");

    const fromMolt = computeCrabMetrics(
      {
        initialWeightG: 400,
        finalWeightG: null,
        purchaseCost: 500,
        stockedDate: t0,
        endDate: null,
        status: "ACTIVE",
        weightLogs: [{ date: t1, weightG: 420 }],
        moltLogs: [
          { date: t2, stage: "HARD" as const, weightAfterG: 480 },
          { date: new Date("2026-10-12T08:00:00+05:30"), stage: "HARDENING" as const, weightAfterG: null },
        ],
        feedLogs: [{ quantityG: 160, costAtTime: 40 }],
        treatmentLogs: [],
        sale: null,
      },
      t2
    );
    expect(fromMolt.latestWeightG).toBe(480);
    expect(fromMolt.weightGainG).toBe(80);
    expect(fromMolt.fcr).toBe(2);

    const zeroGain = computeCrabMetrics(
      {
        initialWeightG: 450,
        finalWeightG: 440,
        purchaseCost: 500,
        stockedDate: t0,
        endDate: t2,
        status: "DEAD",
        weightLogs: [{ date: t1, weightG: 460 }],
        moltLogs: [],
        feedLogs: [{ quantityG: 100, costAtTime: 25 }],
        treatmentLogs: [],
        sale: null,
      },
      t2
    );
    expect(zeroGain.latestWeightG).toBe(440);
    expect(zeroGain.weightGainG).toBe(-10);
    expect(zeroGain.fcr).toBeNull();
  });

  it("classifies CURRENT active tray stay with profit null and MOVED fallback when currentTrayId is non-null", () => {
    const t0 = new Date("2026-10-01T09:00:00+05:30");
    const t1 = new Date("2026-10-06T09:00:00+05:30");
    const rows = buildTrayHistoryRows(
      [
        {
          id: "open-active",
          fromDate: t0,
          toDate: null,
          reason: "STOCKED",
          hasLaterAssignment: false,
          crab: {
            id: "c-act",
            code: "b1",
            initialWeightG: 350,
            finalWeightG: null,
            purchaseCost: 400,
            stockedDate: t0,
            endDate: null,
            status: "ACTIVE",
            currentTrayId: "tray-1",
            weightLogs: [],
            moltLogs: [],
            feedLogs: [],
            treatmentLogs: [],
            sale: null,
          },
        },
        {
          id: "closed-but-active",
          fromDate: t0,
          toDate: t1,
          reason: "MOVED_TO_TREATMENT",
          hasLaterAssignment: false,
          crab: {
            id: "c-still-in-other",
            code: "b2",
            initialWeightG: 380,
            finalWeightG: null,
            purchaseCost: 420,
            stockedDate: t0,
            endDate: null,
            status: "SICK",
            currentTrayId: "tray-12",
            weightLogs: [],
            moltLogs: [],
            feedLogs: [],
            treatmentLogs: [],
            sale: null,
          },
        },
      ],
      t1
    );

    expect(rows[0].outcome).toBe("CURRENT");
    expect(rows[0].profit).toBeNull();
    expect(rows[1].outcome).toBe("MOVED");
    expect(rows[1].profit).toBeNull();
  });
});





