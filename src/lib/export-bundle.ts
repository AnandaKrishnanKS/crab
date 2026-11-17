import { db } from "@/lib/db";
import { toISTDateString } from "@/lib/format";
import { toCsv } from "@/lib/reports";

type ExportScalar = string | number | boolean | null;
type ExportRow = Record<string, ExportScalar>;

export interface ExportTableDefinition {
  key: string;
  filename: string;
  columns: readonly string[];
}

export const EXPORT_TABLE_DEFINITIONS = [
  {
    key: "users",
    filename: "users.csv",
    columns: ["id", "name", "email", "createdAt", "updatedAt"],
  },
  {
    key: "settings",
    filename: "settings.csv",
    columns: [
      "id",
      "systemVolumeLitres",
      "waterChangeWarnDays",
      "waterChangeIntervalDays",
      "waterTestIntervalDays",
      "salinityMin",
      "salinityMax",
      "phMin",
      "phMax",
      "ammoniaMax",
      "nitriteMax",
      "nitrateMax",
      "tempMin",
      "tempMax",
      "targetFatteningDays",
      "lowMineralStockKg",
      "softCrabAlert",
      "nextBatchIndex",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "trays",
    filename: "trays.csv",
    columns: ["id", "number", "isTreatmentTray", "active", "notes", "createdAt", "updatedAt"],
  },
  {
    key: "suppliers",
    filename: "suppliers.csv",
    columns: ["id", "name", "phone", "location", "notes", "active", "createdAt", "updatedAt"],
  },
  {
    key: "buyers",
    filename: "buyers.csv",
    columns: ["id", "name", "phone", "location", "notes", "active", "createdAt", "updatedAt"],
  },
  {
    key: "batches",
    filename: "batches.csv",
    columns: [
      "id",
      "letter",
      "supplierId",
      "purchaseDate",
      "pricePerKg",
      "nextCrabSeq",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "crabs",
    filename: "crabs.csv",
    columns: [
      "id",
      "code",
      "batchId",
      "seq",
      "sex",
      "initialWeightG",
      "purchaseCost",
      "stockedDate",
      "expectedHarvestDate",
      "status",
      "currentTrayId",
      "endDate",
      "deathCause",
      "finalWeightG",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "trayAssignments",
    filename: "tray_assignments.csv",
    columns: ["id", "crabId", "trayId", "fromDate", "toDate", "reason", "createdAt", "updatedAt"],
  },
  {
    key: "weightLogs",
    filename: "weight_logs.csv",
    columns: ["id", "crabId", "date", "weightG", "createdAt", "updatedAt"],
  },
  {
    key: "moltLogs",
    filename: "molt_logs.csv",
    columns: ["id", "crabId", "date", "stage", "weightAfterG", "notes", "createdAt", "updatedAt"],
  },
  {
    key: "feedTypes",
    filename: "feed_types.csv",
    columns: ["id", "name", "costPerKg", "active", "createdAt", "updatedAt"],
  },
  {
    key: "feedLogs",
    filename: "feed_logs.csv",
    columns: [
      "id",
      "crabId",
      "dateTime",
      "feedTypeId",
      "quantityG",
      "timeSlot",
      "costAtTime",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "treatmentLogs",
    filename: "treatment_logs.csv",
    columns: [
      "id",
      "crabId",
      "date",
      "symptoms",
      "diagnosis",
      "treatment",
      "dose",
      "cost",
      "outcome",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "waterTests",
    filename: "water_tests.csv",
    columns: [
      "id",
      "dateTime",
      "salinityPpt",
      "pH",
      "ammoniaMgL",
      "nitriteMgL",
      "nitrateMgL",
      "alkalinityMgL",
      "temperatureC",
      "dissolvedOxygenMgL",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "waterChanges",
    filename: "water_changes.csv",
    columns: [
      "id",
      "date",
      "quantityLitres",
      "percentChanged",
      "notes",
      "calciumMgL",
      "magnesiumMgL",
      "potassiumMgL",
      "sodiumMgL",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "minerals",
    filename: "minerals.csv",
    columns: [
      "id",
      "name",
      "formula",
      "purpose",
      "costPerKg",
      "stockKg",
      "active",
      "notes",
      "naFraction",
      "mgFraction",
      "caFraction",
      "kFraction",
      "clFraction",
      "so4Fraction",
      "hco3Fraction",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "mineralAdditions",
    filename: "mineral_additions.csv",
    columns: [
      "id",
      "dateTime",
      "mineralId",
      "quantityG",
      "costAtTime",
      "reason",
      "waterChangeId",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "systemLogs",
    filename: "system_logs.csv",
    columns: ["id", "date", "type", "quantityLitres", "cost", "notes", "createdAt", "updatedAt"],
  },
  {
    key: "sales",
    filename: "sales.csv",
    columns: [
      "id",
      "crabId",
      "buyerId",
      "date",
      "weightG",
      "pricePerKg",
      "totalAmount",
      "paymentStatus",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "expenses",
    filename: "expenses.csv",
    columns: ["id", "date", "category", "amount", "notes", "createdAt", "updatedAt"],
  },
] as const;

export type ExportTableKey = (typeof EXPORT_TABLE_DEFINITIONS)[number]["key"];

function serializeScalar(val: unknown): ExportScalar {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") {
    return val;
  }
  if (typeof val === "object" && typeof (val as { toString(): string }).toString === "function") {
    const str = (val as { toString(): string }).toString();
    const num = Number(str);
    return Number.isFinite(num) ? num : str;
  }
  return String(val);
}

function serializeRecords(records: unknown[]): ExportRow[] {
  return records.map((record) => {
    const row: ExportRow = {};
    for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
      if (k === "passwordHash") continue;
      row[k] = serializeScalar(v);
    }
    return row;
  });
}

export interface FullExportBundle {
  exportedAt: string;
  dateIST: string;
  app: "MudCrab Manager";
  timezone: "Asia/Kolkata";
  tables: Record<ExportTableKey, ExportRow[]>;
}

/**
 * Fetches all 20 database tables for export/backup while strictly omitting `User.passwordHash`.
 */
export async function buildFullExportBundle(): Promise<FullExportBundle> {
  const [
    users,
    settings,
    trays,
    suppliers,
    buyers,
    batches,
    crabs,
    trayAssignments,
    weightLogs,
    moltLogs,
    feedTypes,
    feedLogs,
    treatmentLogs,
    waterTests,
    waterChanges,
    minerals,
    mineralAdditions,
    systemLogs,
    sales,
    expenses,
  ] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.settings.findMany({ orderBy: { id: "asc" } }),
    db.tray.findMany({ orderBy: { number: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.buyer.findMany({ orderBy: { name: "asc" } }),
    db.batch.findMany({ orderBy: { purchaseDate: "asc" } }),
    db.crab.findMany({ orderBy: [{ stockedDate: "asc" }, { seq: "asc" }] }),
    db.trayAssignment.findMany({ orderBy: { fromDate: "asc" } }),
    db.weightLog.findMany({ orderBy: { date: "asc" } }),
    db.moltLog.findMany({ orderBy: { date: "asc" } }),
    db.feedType.findMany({ orderBy: { name: "asc" } }),
    db.feedLog.findMany({ orderBy: { dateTime: "asc" } }),
    db.treatmentLog.findMany({ orderBy: { date: "asc" } }),
    db.waterTest.findMany({ orderBy: { dateTime: "asc" } }),
    db.waterChange.findMany({ orderBy: { date: "asc" } }),
    db.mineral.findMany({ orderBy: { name: "asc" } }),
    db.mineralAddition.findMany({ orderBy: { dateTime: "asc" } }),
    db.systemLog.findMany({ orderBy: { date: "asc" } }),
    db.sale.findMany({ orderBy: { date: "asc" } }),
    db.expense.findMany({ orderBy: { date: "asc" } }),
  ]);

  const now = new Date();
  return {
    exportedAt: now.toISOString(),
    dateIST: toISTDateString(now),
    app: "MudCrab Manager",
    timezone: "Asia/Kolkata",
    tables: {
      users: serializeRecords(users),
      settings: serializeRecords(settings),
      trays: serializeRecords(trays),
      suppliers: serializeRecords(suppliers),
      buyers: serializeRecords(buyers),
      batches: serializeRecords(batches),
      crabs: serializeRecords(crabs),
      trayAssignments: serializeRecords(trayAssignments),
      weightLogs: serializeRecords(weightLogs),
      moltLogs: serializeRecords(moltLogs),
      feedTypes: serializeRecords(feedTypes),
      feedLogs: serializeRecords(feedLogs),
      treatmentLogs: serializeRecords(treatmentLogs),
      waterTests: serializeRecords(waterTests),
      waterChanges: serializeRecords(waterChanges),
      minerals: serializeRecords(minerals),
      mineralAdditions: serializeRecords(mineralAdditions),
      systemLogs: serializeRecords(systemLogs),
      sales: serializeRecords(sales),
      expenses: serializeRecords(expenses),
    },
  };
}

export function serializeTableToCsv(
  columns: readonly string[],
  rows: ExportRow[]
): string {
  const matrix = rows.map((row) => columns.map((col) => row[col] ?? null));
  return "\uFEFF" + toCsv([...columns], matrix);
}

