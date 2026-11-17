"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { normalizeTrayNumber } from "@/lib/format";
import {
  type ActionResult,
  firstZodError,
  getPrismaErrorMessage,
} from "@/lib/action-result";
import type { MineralPurpose } from "@/generated/prisma/client";

function cleanOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNonNegNumber(
  value: string | number | null | undefined,
  fieldLabel: string
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${fieldLabel} must be 0 or greater`);
  }
  return num;
}

// ---------- TRAYS ----------

const traySchema = z.object({
  id: z.string().optional(),
  number: z.string().trim().min(1, "Tray number is required"),
  isTreatmentTray: z.boolean(),
  active: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
});

export async function upsertTrayAction(
  raw: z.input<typeof traySchema>
): Promise<ActionResult<{ id: string; number: string }>> {
  await requireAuth();
  const parsed = traySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  let normalizedNumber: string;
  try {
    normalizedNumber = normalizeTrayNumber(parsed.data.number);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid tray number",
    };
  }

  try {
    if (parsed.data.id) {
      const existing = await db.tray.findUnique({
        where: { id: parsed.data.id },
        include: { currentCrab: { select: { code: true } } },
      });
      if (!existing) {
        return { ok: false, error: "Tray not found." };
      }
      if (!parsed.data.active && existing.currentCrab) {
        return {
          ok: false,
          error: `Tray ${existing.number} holds crab ${existing.currentCrab.code}. Move or harvest it before deactivating.`,
        };
      }

      const updated = await db.tray.update({
        where: { id: parsed.data.id },
        data: {
          number: normalizedNumber,
          isTreatmentTray: parsed.data.isTreatmentTray,
          active: parsed.data.active,
          notes: cleanOptionalText(parsed.data.notes),
        },
      });
      revalidatePath("/trays");
      revalidatePath(`/trays/${updated.id}`);
      revalidatePath("/");
      revalidatePath("/batches/new");
      return { ok: true, data: { id: updated.id, number: updated.number } };
    }

    const created = await db.tray.create({
      data: {
        number: normalizedNumber,
        isTreatmentTray: parsed.data.isTreatmentTray,
        active: parsed.data.active,
        notes: cleanOptionalText(parsed.data.notes),
      },
    });
    revalidatePath("/trays");
    revalidatePath("/");
    revalidatePath("/batches/new");
    return { ok: true, data: { id: created.id, number: created.number } };
  } catch (err) {
    return {
      ok: false,
      error: getPrismaErrorMessage(
        err,
        `Tray ${normalizedNumber} already exists.`
      ),
    };
  }
}

export async function toggleTrayActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await db.tray.findUnique({
      where: { id },
      include: { currentCrab: { select: { code: true } } },
    });
    if (!existing) return { ok: false, error: "Tray not found." };
    if (!active && existing.currentCrab) {
      return {
        ok: false,
        error: `Tray ${existing.number} currently holds crab ${existing.currentCrab.code}. Move or harvest it first.`,
      };
    }

    await db.tray.update({ where: { id }, data: { active } });
    revalidatePath("/trays");
    revalidatePath("/");
    revalidatePath("/batches/new");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteTrayAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const tray = await db.tray.findUnique({
      where: { id },
      include: {
        currentCrab: { select: { code: true } },
        _count: { select: { assignments: true } },
      },
    });
    if (!tray) return { ok: false, error: "Tray not found." };

    if (tray.currentCrab) {
      return {
        ok: false,
        error: `Tray ${tray.number} currently holds crab ${tray.currentCrab.code}. Move or harvest the crab first.`,
      };
    }
    if (tray._count.assignments > 0) {
      return {
        ok: false,
        blockedByHistory: true,
        error: `Tray ${tray.number} has ${tray._count.assignments} historical assignment${tray._count.assignments === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`,
      };
    }

    await db.tray.delete({ where: { id } });
    revalidatePath("/trays");
    revalidatePath("/");
    revalidatePath("/batches/new");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- SUPPLIERS & BUYERS ----------

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().max(40).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean(),
});

function contactWriteData(data: z.infer<typeof contactSchema>) {
  return {
    name: data.name,
    phone: cleanOptionalText(data.phone),
    location: cleanOptionalText(data.location),
    notes: cleanOptionalText(data.notes),
    active: data.active,
  };
}

export async function upsertSupplierAction(
  raw: z.input<typeof contactSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  try {
    const payload = contactWriteData(parsed.data);
    const record = parsed.data.id
      ? await db.supplier.update({ where: { id: parsed.data.id }, data: payload })
      : await db.supplier.create({ data: payload });
    revalidatePath("/contacts");
    revalidatePath("/batches/new");
    revalidatePath("/crabs");
    return { ok: true, data: { id: record.id } };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function toggleSupplierActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.supplier.update({ where: { id }, data: { active } });
    revalidatePath("/contacts");
    revalidatePath("/batches/new");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { batches: true } } },
    });
    if (!supplier) return { ok: false, error: "Supplier not found." };
    if (supplier._count.batches > 0) {
      return {
        ok: false,
        blockedByHistory: true,
        error: `${supplier.name} is linked to ${supplier._count.batches} batch${supplier._count.batches === 1 ? "" : "es"}, so it cannot be deleted. Deactivate it instead?`,
      };
    }

    await db.supplier.delete({ where: { id } });
    revalidatePath("/contacts");
    revalidatePath("/batches/new");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function upsertBuyerAction(
  raw: z.input<typeof contactSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  try {
    const payload = contactWriteData(parsed.data);
    const record = parsed.data.id
      ? await db.buyer.update({ where: { id: parsed.data.id }, data: payload })
      : await db.buyer.create({ data: payload });
    revalidatePath("/contacts");
    revalidatePath("/crabs");
    revalidatePath("/reports");
    return { ok: true, data: { id: record.id } };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function toggleBuyerActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.buyer.update({ where: { id }, data: { active } });
    revalidatePath("/contacts");
    revalidatePath("/crabs");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteBuyerAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const buyer = await db.buyer.findUnique({
      where: { id },
      include: { _count: { select: { sales: true } } },
    });
    if (!buyer) return { ok: false, error: "Buyer not found." };
    if (buyer._count.sales > 0) {
      return {
        ok: false,
        blockedByHistory: true,
        error: `${buyer.name} has ${buyer._count.sales} recorded sale${buyer._count.sales === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`,
      };
    }

    await db.buyer.delete({ where: { id } });
    revalidatePath("/contacts");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- FEED TYPES ----------

const feedTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Feed name is required").max(80),
  costPerKg: z.coerce
    .number()
    .finite()
    .min(0, "Cost per kg cannot be negative")
    .max(100000, "Cost per kg is too large"),
  active: z.boolean(),
});

export async function upsertFeedTypeAction(
  raw: z.input<typeof feedTypeSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = feedTypeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  try {
    const data = {
      name: parsed.data.name,
      costPerKg: parsed.data.costPerKg,
      active: parsed.data.active,
    };
    const record = parsed.data.id
      ? await db.feedType.update({ where: { id: parsed.data.id }, data })
      : await db.feedType.create({ data });
    revalidatePath("/feed-types");
    revalidatePath("/daily");
    return { ok: true, data: { id: record.id } };
  } catch (err) {
    return {
      ok: false,
      error: getPrismaErrorMessage(
        err,
        `A feed type named "${parsed.data.name}" already exists.`
      ),
    };
  }
}

export async function toggleFeedTypeActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.feedType.update({ where: { id }, data: { active } });
    revalidatePath("/feed-types");
    revalidatePath("/daily");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteFeedTypeAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const feedType = await db.feedType.findUnique({
      where: { id },
      include: { _count: { select: { feedLogs: true } } },
    });
    if (!feedType) return { ok: false, error: "Feed type not found." };
    if (feedType._count.feedLogs > 0) {
      return {
        ok: false,
        blockedByHistory: true,
        error: `${feedType.name} is used in ${feedType._count.feedLogs} feeding log${feedType._count.feedLogs === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`,
      };
    }

    await db.feedType.delete({ where: { id } });
    revalidatePath("/feed-types");
    revalidatePath("/daily");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MINERALS ----------

const fractionSchema = z.coerce
  .number()
  .finite()
  .min(0, "Ion fraction must be between 0 and 1")
  .max(1, "Ion fraction must be between 0 and 1");

const mineralSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Chemical name is required").max(100),
    formula: z.string().trim().min(1, "Formula is required").max(60),
    purpose: z.enum(["SALINITY", "MINERAL_BALANCE", "PH_BUFFER"]),
    costPerKg: z.coerce
      .number()
      .finite()
      .min(0, "Cost per kg cannot be negative")
      .max(100000),
    stockKg: z.union([z.string(), z.number(), z.null(), z.undefined()]),
    active: z.boolean(),
    notes: z.string().max(500).optional().nullable(),
    naFraction: fractionSchema,
    mgFraction: fractionSchema,
    caFraction: fractionSchema,
    kFraction: fractionSchema,
    clFraction: fractionSchema,
    so4Fraction: fractionSchema,
    hco3Fraction: fractionSchema,
  })
  .refine(
    (d) =>
      d.naFraction +
        d.mgFraction +
        d.caFraction +
        d.kFraction +
        d.clFraction +
        d.so4Fraction +
        d.hco3Fraction <=
      1.01,
    {
      message: "Total ion fractions cannot exceed 1.00 of total chemical mass.",
    }
  );

export async function upsertMineralAction(
  raw: z.input<typeof mineralSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = mineralSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  let stockKg: number | null = null;
  try {
    stockKg = parseOptionalNonNegNumber(parsed.data.stockKg, "Stock (kg)");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid stock quantity",
    };
  }

  try {
    const data = {
      name: parsed.data.name,
      formula: parsed.data.formula,
      purpose: parsed.data.purpose as MineralPurpose,
      costPerKg: parsed.data.costPerKg,
      stockKg,
      active: parsed.data.active,
      notes: cleanOptionalText(parsed.data.notes),
      naFraction: parsed.data.naFraction,
      mgFraction: parsed.data.mgFraction,
      caFraction: parsed.data.caFraction,
      kFraction: parsed.data.kFraction,
      clFraction: parsed.data.clFraction,
      so4Fraction: parsed.data.so4Fraction,
      hco3Fraction: parsed.data.hco3Fraction,
    };

    const record = parsed.data.id
      ? await db.mineral.update({ where: { id: parsed.data.id }, data })
      : await db.mineral.create({ data });

    revalidatePath("/settings");
    revalidatePath("/water");
    revalidatePath("/");
    return { ok: true, data: { id: record.id } };
  } catch (err) {
    return {
      ok: false,
      error: getPrismaErrorMessage(
        err,
        `A chemical named "${parsed.data.name}" already exists.`
      ),
    };
  }
}

export async function toggleMineralActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.mineral.update({ where: { id }, data: { active } });
    revalidatePath("/settings");
    revalidatePath("/water");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteMineralAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const mineral = await db.mineral.findUnique({
      where: { id },
      include: { _count: { select: { additions: true } } },
    });
    if (!mineral) return { ok: false, error: "Chemical not found." };
    if (mineral._count.additions > 0) {
      return {
        ok: false,
        blockedByHistory: true,
        error: `${mineral.name} is linked to ${mineral._count.additions} chemical addition${mineral._count.additions === 1 ? "" : "s"}, so it cannot be deleted. Deactivate it instead?`,
      };
    }

    await db.mineral.delete({ where: { id } });
    revalidatePath("/settings");
    revalidatePath("/water");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

