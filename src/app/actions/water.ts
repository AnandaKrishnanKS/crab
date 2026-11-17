"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { parseISTDate, toNumber } from "@/lib/format";
import {
  type ActionResult,
  firstZodError,
  getPrismaErrorMessage,
} from "@/lib/action-result";
import type {
  MineralAdditionReason,
  SystemLogType,
} from "@/generated/prisma/client";

function cleanOpt(val: string | null | undefined): string | null {
  const s = val?.trim();
  return s ? s : null;
}

function optFloat(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : null;
}

const optNumInput = z.union([z.string(), z.number(), z.null(), z.undefined()]);

const waterTestSchema = z.object({
  id: z.string().optional(),
  dateTime: z.string().min(1, "Date & time are required"),
  salinityPpt: optNumInput,
  pH: optNumInput,
  ammoniaMgL: optNumInput,
  nitriteMgL: optNumInput,
  nitrateMgL: optNumInput,
  alkalinityMgL: optNumInput,
  temperatureC: optNumInput,
  dissolvedOxygenMgL: optNumInput,
  notes: z.string().max(500).optional().nullable(),
});

function buildWaterTestData(d: z.infer<typeof waterTestSchema>, dateTime: Date) {
  const fields = {
    salinityPpt: optFloat(d.salinityPpt),
    pH: optFloat(d.pH),
    ammoniaMgL: optFloat(d.ammoniaMgL),
    nitriteMgL: optFloat(d.nitriteMgL),
    nitrateMgL: optFloat(d.nitrateMgL),
    alkalinityMgL: optFloat(d.alkalinityMgL),
    temperatureC: optFloat(d.temperatureC),
    dissolvedOxygenMgL: optFloat(d.dissolvedOxygenMgL),
  };

  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v < 0) {
      throw new Error(`${k} cannot be negative.`);
    }
  }
  if (fields.pH !== null && (fields.pH < 0 || fields.pH > 14)) {
    throw new Error("pH must be between 0 and 14.");
  }

  return {
    dateTime,
    ...fields,
    notes: cleanOpt(d.notes),
  };
}

export async function addWaterTestAction(
  raw: z.input<typeof waterTestSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = waterTestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const data = buildWaterTestData(parsed.data, when);
    const created = await db.waterTest.create({ data });
    revalidatePath("/");
    revalidatePath("/daily");
    revalidatePath("/water");
    return { ok: true, data: { id: created.id }, message: "Water test logged." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function updateWaterTestAction(
  raw: z.input<typeof waterTestSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = waterTestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.id) return { ok: false, error: "Missing water test id." };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const data = buildWaterTestData(parsed.data, when);
    await db.waterTest.update({ where: { id: parsed.data.id }, data });
    revalidatePath("/");
    revalidatePath("/daily");
    revalidatePath("/water");
    return { ok: true, message: "Water test updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteWaterTestAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.waterTest.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/daily");
    revalidatePath("/water");
    return { ok: true, message: "Water test deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

function revalidateWaterRoutes() {
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath("/water");
  revalidatePath("/settings");
  revalidatePath("/reports");
}

function adjustStockKg(current: number | null, deltaKg: number): number | null {
  if (current === null) return null;
  return Math.max(0, Math.round((current + deltaKg) * 10000) / 10000);
}

// ---------- WATER CHANGES ----------

const waterChangeChemicalSchema = z.object({
  mineralId: z.string().min(1, "Select mineral"),
  quantityG: z.coerce.number().finite().positive("Quantity must be > 0 g").max(500000),
  costAtTime: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  notes: z.string().max(400).optional().nullable(),
});

const waterChangeSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  quantityLitres: z.coerce
    .number()
    .finite()
    .positive("Quantity (L) must be > 0")
    .max(1000000),
  percentChanged: z.coerce
    .number()
    .finite()
    .positive("Percent changed must be > 0")
    .max(100, "Percent changed cannot exceed 100%"),
  calciumMgL: optNumInput,
  magnesiumMgL: optNumInput,
  potassiumMgL: optNumInput,
  sodiumMgL: optNumInput,
  notes: z.string().max(500).optional().nullable(),
  chemicals: z.array(waterChangeChemicalSchema).optional(),
});

function buildWaterChangeFields(d: z.infer<typeof waterChangeSchema>, when: Date) {
  const calciumMgL = optFloat(d.calciumMgL);
  const magnesiumMgL = optFloat(d.magnesiumMgL);
  const potassiumMgL = optFloat(d.potassiumMgL);
  const sodiumMgL = optFloat(d.sodiumMgL);

  for (const [label, val] of [
    ["Calcium", calciumMgL],
    ["Magnesium", magnesiumMgL],
    ["Potassium", potassiumMgL],
    ["Sodium", sodiumMgL],
  ] as const) {
    if (val !== null && val < 0) {
      throw new Error(`${label} reading cannot be negative.`);
    }
  }

  return {
    date: when,
    quantityLitres: d.quantityLitres,
    percentChanged: d.percentChanged,
    calciumMgL,
    magnesiumMgL,
    potassiumMgL,
    sodiumMgL,
    notes: cleanOpt(d.notes),
  };
}

export async function addWaterChangeAction(
  raw: z.input<typeof waterChangeSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = waterChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  const chemicals = parsed.data.chemicals ?? [];

  try {
    const fields = buildWaterChangeFields(parsed.data, when);

    const created = await db.$transaction(async (tx) => {
      const wc = await tx.waterChange.create({ data: fields });

      if (chemicals.length > 0) {
        const mineralIds = Array.from(new Set(chemicals.map((c) => c.mineralId)));
        const minerals = await tx.mineral.findMany({
          where: { id: { in: mineralIds } },
        });
        const mineralMap = new Map(minerals.map((m) => [m.id, m]));
        const stockDeltaByMineral = new Map<string, number>();

        for (const item of chemicals) {
          const mineral = mineralMap.get(item.mineralId);
          if (!mineral) throw new Error("Selected mineral not found.");

          const parsedCost = optFloat(item.costAtTime);
          const costAtTime =
            parsedCost !== null && parsedCost >= 0
              ? Math.round(parsedCost * 100) / 100
              : Math.round(
                  (item.quantityG / 1000) * toNumber(mineral.costPerKg) * 100
                ) / 100;

          await tx.mineralAddition.create({
            data: {
              dateTime: when,
              mineralId: mineral.id,
              quantityG: item.quantityG,
              costAtTime,
              reason: "WATER_CHANGE",
              waterChangeId: wc.id,
              notes: cleanOpt(item.notes),
            },
          });

          if (mineral.stockKg !== null) {
            stockDeltaByMineral.set(
              mineral.id,
              (stockDeltaByMineral.get(mineral.id) ?? 0) - item.quantityG / 1000
            );
          }
        }

        for (const [mId, deltaKg] of stockDeltaByMineral.entries()) {
          const cur = mineralMap.get(mId);
          if (cur && cur.stockKg !== null) {
            await tx.mineral.update({
              where: { id: mId },
              data: { stockKg: adjustStockKg(cur.stockKg, deltaKg) },
            });
          }
        }
      }

      return wc;
    });

    revalidateWaterRoutes();
    return {
      ok: true,
      data: { id: created.id },
      message: "Water change logged.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function updateWaterChangeAction(
  raw: z.input<typeof waterChangeSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = waterChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.id) return { ok: false, error: "Missing water change id." };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const fields = buildWaterChangeFields(parsed.data, when);
    await db.waterChange.update({
      where: { id: parsed.data.id },
      data: fields,
    });
    revalidateWaterRoutes();
    return { ok: true, message: "Water change updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteWaterChangeAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const wc = await db.waterChange.findUnique({
      where: { id },
      include: {
        mineralAdditions: {
          include: { mineral: { select: { id: true, stockKg: true } } },
        },
      },
    });
    if (!wc) return { ok: false, error: "Water change not found." };

    await db.$transaction(async (tx) => {
      // Group linked chemical quantities to restore tracked Mineral.stockKg atomically
      const restoreByMineral = new Map<string, number>();
      for (const add of wc.mineralAdditions) {
        if (add.mineral.stockKg !== null) {
          restoreByMineral.set(
            add.mineralId,
            (restoreByMineral.get(add.mineralId) ?? 0) + add.quantityG / 1000
          );
        }
      }

      for (const [mId, restoreKg] of restoreByMineral.entries()) {
        const mineral = await tx.mineral.findUnique({
          where: { id: mId },
          select: { stockKg: true },
        });
        if (mineral && mineral.stockKg !== null) {
          await tx.mineral.update({
            where: { id: mId },
            data: { stockKg: adjustStockKg(mineral.stockKg, restoreKg) },
          });
        }
      }

      // Cascade delete removes linked MineralAddition records inside the same transaction
      await tx.waterChange.delete({ where: { id: wc.id } });
    });

    revalidateWaterRoutes();
    return {
      ok: true,
      message:
        wc.mineralAdditions.length > 0
          ? `Water change deleted and ${wc.mineralAdditions.length} linked chemical addition(s) restored to stock.`
          : "Water change deleted.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MINERAL ADDITIONS ----------

const mineralAdditionReasonEnum = z.enum([
  "SALINITY_ADJUST",
  "PH_ADJUST",
  "WATER_CHANGE",
  "TOP_UP",
  "OTHER",
]);

const mineralAdditionSchema = z.object({
  id: z.string().optional(),
  dateTime: z.string().min(1, "Date & time are required"),
  mineralId: z.string().min(1, "Select mineral"),
  quantityG: z.coerce.number().finite().positive("Quantity must be > 0 g").max(500000),
  costAtTime: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  reason: mineralAdditionReasonEnum,
  waterChangeId: z.string().optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

const mineralAdditionsBatchSchema = z.object({
  dateTime: z.string().min(1, "Date & time are required"),
  items: z
    .array(
      z.object({
        mineralId: z.string().min(1, "Select mineral"),
        quantityG: z.coerce
          .number()
          .finite()
          .positive("Quantity must be > 0 g")
          .max(500000),
        costAtTime: z.union([z.string(), z.number(), z.null(), z.undefined()]),
        reason: mineralAdditionReasonEnum,
        notes: z.string().max(400).optional().nullable(),
      })
    )
    .min(1, "Add at least one chemical row"),
});

export async function addMineralAdditionAction(
  raw: z.input<typeof mineralAdditionSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = mineralAdditionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const created = await db.$transaction(async (tx) => {
      const mineral = await tx.mineral.findUnique({
        where: { id: parsed.data.mineralId },
      });
      if (!mineral) throw new Error("Mineral not found.");

      const wcId = cleanOpt(parsed.data.waterChangeId);
      if (wcId) {
        const wc = await tx.waterChange.findUnique({ where: { id: wcId } });
        if (!wc) throw new Error("Linked water change not found.");
      }

      const parsedCost = optFloat(parsed.data.costAtTime);
      const costAtTime =
        parsedCost !== null && parsedCost >= 0
          ? Math.round(parsedCost * 100) / 100
          : Math.round(
              (parsed.data.quantityG / 1000) * toNumber(mineral.costPerKg) * 100
            ) / 100;

      const row = await tx.mineralAddition.create({
        data: {
          dateTime: when,
          mineralId: mineral.id,
          quantityG: parsed.data.quantityG,
          costAtTime,
          reason: parsed.data.reason as MineralAdditionReason,
          waterChangeId: wcId,
          notes: cleanOpt(parsed.data.notes),
        },
      });

      if (mineral.stockKg !== null) {
        await tx.mineral.update({
          where: { id: mineral.id },
          data: {
            stockKg: adjustStockKg(mineral.stockKg, -parsed.data.quantityG / 1000),
          },
        });
      }

      return row;
    });

    revalidateWaterRoutes();
    return {
      ok: true,
      data: { id: created.id },
      message: "Chemical addition logged.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function addMineralAdditionsBatchAction(
  raw: z.input<typeof mineralAdditionsBatchSchema>
): Promise<ActionResult<{ count: number }>> {
  await requireAuth();
  const parsed = mineralAdditionsBatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    await db.$transaction(async (tx) => {
      const mineralIds = Array.from(
        new Set(parsed.data.items.map((i) => i.mineralId))
      );
      const minerals = await tx.mineral.findMany({
        where: { id: { in: mineralIds } },
      });
      const mineralMap = new Map(minerals.map((m) => [m.id, m]));
      const stockDeltaByMineral = new Map<string, number>();

      for (const item of parsed.data.items) {
        const mineral = mineralMap.get(item.mineralId);
        if (!mineral) throw new Error("Mineral not found.");

        const parsedCost = optFloat(item.costAtTime);
        const costAtTime =
          parsedCost !== null && parsedCost >= 0
            ? Math.round(parsedCost * 100) / 100
            : Math.round(
                (item.quantityG / 1000) * toNumber(mineral.costPerKg) * 100
              ) / 100;

        await tx.mineralAddition.create({
          data: {
            dateTime: when,
            mineralId: mineral.id,
            quantityG: item.quantityG,
            costAtTime,
            reason: item.reason as MineralAdditionReason,
            notes: cleanOpt(item.notes),
          },
        });

        if (mineral.stockKg !== null) {
          stockDeltaByMineral.set(
            mineral.id,
            (stockDeltaByMineral.get(mineral.id) ?? 0) - item.quantityG / 1000
          );
        }
      }

      for (const [mId, deltaKg] of stockDeltaByMineral.entries()) {
        const mineral = mineralMap.get(mId);
        if (mineral && mineral.stockKg !== null) {
          await tx.mineral.update({
            where: { id: mId },
            data: { stockKg: adjustStockKg(mineral.stockKg, deltaKg) },
          });
        }
      }
    });

    revalidateWaterRoutes();
    return {
      ok: true,
      data: { count: parsed.data.items.length },
      message: `Logged ${parsed.data.items.length} chemical addition(s).`,
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function updateMineralAdditionAction(
  raw: z.input<typeof mineralAdditionSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = mineralAdditionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.id) return { ok: false, error: "Missing chemical addition id." };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.mineralAddition.findUnique({
        where: { id: parsed.data.id },
        include: { mineral: true },
      });
      if (!existing) throw new Error("Chemical addition not found.");

      const targetMineral =
        existing.mineralId === parsed.data.mineralId
          ? existing.mineral
          : await tx.mineral.findUnique({ where: { id: parsed.data.mineralId } });
      if (!targetMineral) throw new Error("Mineral not found.");

      const parsedCost = optFloat(parsed.data.costAtTime);
      const costAtTime =
        parsedCost !== null && parsedCost >= 0
          ? Math.round(parsedCost * 100) / 100
          : Math.round(
              (parsed.data.quantityG / 1000) *
                toNumber(targetMineral.costPerKg) *
                100
            ) / 100;

      // Restore old stock & apply new stock cleanly
      if (existing.mineralId === targetMineral.id) {
        if (targetMineral.stockKg !== null) {
          const deltaKg = (existing.quantityG - parsed.data.quantityG) / 1000;
          await tx.mineral.update({
            where: { id: targetMineral.id },
            data: { stockKg: adjustStockKg(targetMineral.stockKg, deltaKg) },
          });
        }
      } else {
        if (existing.mineral.stockKg !== null) {
          await tx.mineral.update({
            where: { id: existing.mineralId },
            data: {
              stockKg: adjustStockKg(
                existing.mineral.stockKg,
                existing.quantityG / 1000
              ),
            },
          });
        }
        if (targetMineral.stockKg !== null) {
          await tx.mineral.update({
            where: { id: targetMineral.id },
            data: {
              stockKg: adjustStockKg(
                targetMineral.stockKg,
                -parsed.data.quantityG / 1000
              ),
            },
          });
        }
      }

      const wcId = cleanOpt(parsed.data.waterChangeId);
      await tx.mineralAddition.update({
        where: { id: existing.id },
        data: {
          dateTime: when,
          mineralId: targetMineral.id,
          quantityG: parsed.data.quantityG,
          costAtTime,
          reason: parsed.data.reason as MineralAdditionReason,
          waterChangeId: wcId,
          notes: cleanOpt(parsed.data.notes),
        },
      });
    });

    revalidateWaterRoutes();
    return { ok: true, message: "Chemical addition updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteMineralAdditionAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.mineralAddition.findUnique({
        where: { id },
        include: { mineral: { select: { id: true, stockKg: true } } },
      });
      if (!existing) throw new Error("Chemical addition not found.");

      if (existing.mineral.stockKg !== null) {
        await tx.mineral.update({
          where: { id: existing.mineralId },
          data: {
            stockKg: adjustStockKg(
              existing.mineral.stockKg,
              existing.quantityG / 1000
            ),
          },
        });
      }

      await tx.mineralAddition.delete({ where: { id: existing.id } });
    });

    revalidateWaterRoutes();
    return { ok: true, message: "Chemical addition deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- SYSTEM MAINTENANCE LOGS ----------

const systemLogSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  type: z.enum([
    "TOP_UP",
    "BIOFILTER_CLEAN",
    "MECHANICAL_FILTER_CLEAN",
    "UV_SERVICE",
    "PUMP_SERVICE",
    "OTHER",
  ]),
  quantityLitres: optNumInput,
  cost: optNumInput,
  notes: z.string().max(500).optional().nullable(),
});

export async function addSystemLogAction(
  raw: z.input<typeof systemLogSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = systemLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  const quantityLitres = optFloat(parsed.data.quantityLitres);
  const cost = optFloat(parsed.data.cost);
  if (quantityLitres !== null && quantityLitres < 0) {
    return { ok: false, error: "Quantity (L) cannot be negative." };
  }
  if (cost !== null && cost < 0) {
    return { ok: false, error: "Cost (₹) cannot be negative." };
  }

  try {
    const created = await db.systemLog.create({
      data: {
        date: when,
        type: parsed.data.type as SystemLogType,
        quantityLitres,
        cost: cost !== null ? Math.round(cost * 100) / 100 : null,
        notes: cleanOpt(parsed.data.notes),
      },
    });
    revalidateWaterRoutes();
    return {
      ok: true,
      data: { id: created.id },
      message: "Maintenance log saved.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function updateSystemLogAction(
  raw: z.input<typeof systemLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = systemLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.id) return { ok: false, error: "Missing maintenance log id." };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  const quantityLitres = optFloat(parsed.data.quantityLitres);
  const cost = optFloat(parsed.data.cost);
  if (quantityLitres !== null && quantityLitres < 0) {
    return { ok: false, error: "Quantity (L) cannot be negative." };
  }
  if (cost !== null && cost < 0) {
    return { ok: false, error: "Cost (₹) cannot be negative." };
  }

  try {
    await db.systemLog.update({
      where: { id: parsed.data.id },
      data: {
        date: when,
        type: parsed.data.type as SystemLogType,
        quantityLitres,
        cost: cost !== null ? Math.round(cost * 100) / 100 : null,
        notes: cleanOpt(parsed.data.notes),
      },
    });
    revalidateWaterRoutes();
    return { ok: true, message: "Maintenance log updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteSystemLogAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.systemLog.delete({ where: { id } });
    revalidateWaterRoutes();
    return { ok: true, message: "Maintenance log deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

