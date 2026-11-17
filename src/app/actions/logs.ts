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
  FeedTimeSlot,
  MoltStage,
  TreatmentOutcome,
} from "@/generated/prisma/client";

function cleanOpt(val: string | null | undefined): string | null {
  const s = val?.trim();
  return s ? s : null;
}

function parseOptionalNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : null;
}

function revalidateCrabRoutes(crabId: string, trayId?: string | null) {
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath("/crabs");
  revalidatePath(`/crabs/${crabId}`);
  revalidatePath("/feed-types");
  revalidatePath("/reports");
  if (trayId) revalidatePath(`/trays/${trayId}`);
}

// ---------- FEED LOGS ----------

const feedLogSchema = z.object({
  crabId: z.string().min(1),
  dateTime: z.string().min(1, "Date & time are required"),
  feedTypeId: z.string().min(1, "Select a feed type"),
  quantityG: z.coerce.number().finite().positive("Quantity must be > 0 g").max(5000),
  timeSlot: z.enum(["MORNING", "EVENING", "NIGHT"]),
  notes: z.string().max(400).optional().nullable(),
});

export async function addFeedLogAction(
  raw: z.input<typeof feedLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = feedLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const [crab, feedType] = await Promise.all([
      db.crab.findUnique({ where: { id: parsed.data.crabId } }),
      db.feedType.findUnique({ where: { id: parsed.data.feedTypeId } }),
    ]);
    if (!crab) return { ok: false, error: "Crab not found." };
    if (crab.status === "SOLD" || crab.status === "DEAD") {
      return { ok: false, error: "Cannot log feed for a SOLD or DEAD crab." };
    }
    if (!feedType) return { ok: false, error: "Feed type not found." };

    const costAtTime =
      Math.round((parsed.data.quantityG / 1000) * toNumber(feedType.costPerKg) * 100) /
      100;

    await db.feedLog.create({
      data: {
        crabId: crab.id,
        dateTime: when,
        feedTypeId: feedType.id,
        quantityG: parsed.data.quantityG,
        timeSlot: parsed.data.timeSlot as FeedTimeSlot,
        costAtTime,
        notes: cleanOpt(parsed.data.notes),
      },
    });

    revalidateCrabRoutes(crab.id, crab.currentTrayId);
    return { ok: true, message: "Feed logged." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const batchFeedSchema = z.object({
  dateTime: z.string().min(1, "Date & time are required"),
  timeSlot: z.enum(["MORNING", "EVENING", "NIGHT"]),
  items: z
    .array(
      z.object({
        crabId: z.string().min(1),
        feedTypeId: z.string().min(1, "Select feed type"),
        quantityG: z.coerce
          .number()
          .finite()
          .positive("Quantity must be > 0 g")
          .max(5000),
        notes: z.string().max(400).optional().nullable(),
      })
    )
    .min(1, "Select at least one crab with quantity > 0 g"),
});

export async function batchFeedCrabsAction(
  raw: z.input<typeof batchFeedSchema>
): Promise<ActionResult<{ count: number }>> {
  await requireAuth();
  const parsed = batchFeedSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const crabIds = parsed.data.items.map((i) => i.crabId);
    const feedTypeIds = Array.from(
      new Set(parsed.data.items.map((i) => i.feedTypeId))
    );

    const trayIdsToRevalidate = await db.$transaction(async (tx) => {
      const [crabs, feedTypes] = await Promise.all([
        tx.crab.findMany({
          where: { id: { in: crabIds } },
          select: { id: true, code: true, status: true, currentTrayId: true },
        }),
        tx.feedType.findMany({
          where: { id: { in: feedTypeIds } },
          select: { id: true, costPerKg: true },
        }),
      ]);

      const crabMap = new Map(crabs.map((c) => [c.id, c]));
      const ftMap = new Map(feedTypes.map((f) => [f.id, f]));
      const trayIds = new Set<string>();

      for (const item of parsed.data.items) {
        const crab = crabMap.get(item.crabId);
        if (!crab) throw new Error("One or more crabs were not found.");
        if (crab.status !== "ACTIVE") {
          throw new Error(`Crab ${crab.code} is ${crab.status} and skipped in Daily Log.`);
        }
        const ft = ftMap.get(item.feedTypeId);
        if (!ft) throw new Error("Selected feed type was not found.");
        if (crab.currentTrayId) trayIds.add(crab.currentTrayId);

        const costAtTime =
          Math.round((item.quantityG / 1000) * toNumber(ft.costPerKg) * 100) / 100;

        await tx.feedLog.create({
          data: {
            crabId: crab.id,
            dateTime: when,
            feedTypeId: ft.id,
            quantityG: item.quantityG,
            timeSlot: parsed.data.timeSlot as FeedTimeSlot,
            costAtTime,
            notes: cleanOpt(item.notes),
          },
        });
      }

      return Array.from(trayIds);
    });

    revalidatePath("/");
    revalidatePath("/daily");
    revalidatePath("/crabs");
    revalidatePath("/feed-types");
    for (const cId of crabIds) revalidatePath(`/crabs/${cId}`);
    for (const tId of trayIdsToRevalidate) revalidatePath(`/trays/${tId}`);

    return {
      ok: true,
      data: { count: parsed.data.items.length },
      message: `Logged feed for ${parsed.data.items.length} crab${
        parsed.data.items.length === 1 ? "" : "s"
      }.`,
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const updateFeedLogSchema = z.object({
  id: z.string().min(1),
  dateTime: z.string().min(1, "Date & time are required"),
  feedTypeId: z.string().min(1, "Select feed type"),
  quantityG: z.coerce.number().finite().positive("Quantity must be > 0 g").max(5000),
  timeSlot: z.enum(["MORNING", "EVENING", "NIGHT"]),
  costAtTime: z.coerce.number().finite().min(0).max(100000),
  notes: z.string().max(400).optional().nullable(),
});

export async function updateFeedLogAction(
  raw: z.input<typeof updateFeedLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateFeedLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.dateTime);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    const existing = await db.feedLog.findUnique({
      where: { id: parsed.data.id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Feed log not found." };

    await db.feedLog.update({
      where: { id: existing.id },
      data: {
        dateTime: when,
        feedTypeId: parsed.data.feedTypeId,
        quantityG: parsed.data.quantityG,
        timeSlot: parsed.data.timeSlot as FeedTimeSlot,
        costAtTime: parsed.data.costAtTime,
        notes: cleanOpt(parsed.data.notes),
      },
    });

    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Feed log updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteFeedLogAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await db.feedLog.findUnique({
      where: { id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Feed log not found." };

    await db.feedLog.delete({ where: { id } });
    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Feed log deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- WEIGHT LOGS ----------

const weightLogSchema = z.object({
  crabId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  weightG: z.coerce.number().finite().positive("Weight must be > 0 g").max(5000),
});

export async function addWeightLogAction(
  raw: z.input<typeof weightLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = weightLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const crab = await db.crab.findUnique({ where: { id: parsed.data.crabId } });
    if (!crab) return { ok: false, error: "Crab not found." };

    await db.weightLog.create({
      data: { crabId: crab.id, date: when, weightG: parsed.data.weightG },
    });

    revalidateCrabRoutes(crab.id, crab.currentTrayId);
    return { ok: true, message: "Weight recorded." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const updateWeightLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  weightG: z.coerce.number().finite().positive("Weight must be > 0 g").max(5000),
});

export async function updateWeightLogAction(
  raw: z.input<typeof updateWeightLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateWeightLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const existing = await db.weightLog.findUnique({
      where: { id: parsed.data.id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Weight log not found." };

    await db.weightLog.update({
      where: { id: existing.id },
      data: { date: when, weightG: parsed.data.weightG },
    });

    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Weight log updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteWeightLogAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await db.weightLog.findUnique({
      where: { id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Weight log not found." };

    await db.weightLog.delete({ where: { id } });
    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Weight log deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MOLT LOGS ----------

const moltLogSchema = z.object({
  crabId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  stage: z.enum(["PRE_MOLT", "MOLTED", "SOFT", "HARDENING", "HARD"]),
  weightAfterG: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  notes: z.string().max(400).optional().nullable(),
});

export async function addMoltLogAction(
  raw: z.input<typeof moltLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = moltLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };
  const weightAfterG = parseOptionalNumber(parsed.data.weightAfterG);
  if (weightAfterG !== null && weightAfterG <= 0) {
    return { ok: false, error: "Weight after molt must be > 0 g." };
  }

  try {
    const crab = await db.crab.findUnique({ where: { id: parsed.data.crabId } });
    if (!crab) return { ok: false, error: "Crab not found." };

    await db.moltLog.create({
      data: {
        crabId: crab.id,
        date: when,
        stage: parsed.data.stage as MoltStage,
        weightAfterG,
        notes: cleanOpt(parsed.data.notes),
      },
    });

    revalidateCrabRoutes(crab.id, crab.currentTrayId);
    return { ok: true, message: "Molt stage logged." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const updateMoltLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  stage: z.enum(["PRE_MOLT", "MOLTED", "SOFT", "HARDENING", "HARD"]),
  weightAfterG: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  notes: z.string().max(400).optional().nullable(),
});

export async function updateMoltLogAction(
  raw: z.input<typeof updateMoltLogSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateMoltLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };
  const weightAfterG = parseOptionalNumber(parsed.data.weightAfterG);
  if (weightAfterG !== null && weightAfterG <= 0) {
    return { ok: false, error: "Weight after molt must be > 0 g." };
  }

  try {
    const existing = await db.moltLog.findUnique({
      where: { id: parsed.data.id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Molt log not found." };

    await db.moltLog.update({
      where: { id: existing.id },
      data: {
        date: when,
        stage: parsed.data.stage as MoltStage,
        weightAfterG,
        notes: cleanOpt(parsed.data.notes),
      },
    });

    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Molt log updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteMoltLogAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await db.moltLog.findUnique({
      where: { id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Molt log not found." };

    await db.moltLog.delete({ where: { id } });
    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Molt log deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- TREATMENT LOGS ----------

const updateTreatmentSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  symptoms: z.string().trim().min(1, "Symptoms are required").max(400),
  diagnosis: z.string().max(400).optional().nullable(),
  treatment: z.string().trim().min(1, "Treatment is required").max(400),
  dose: z.string().max(200).optional().nullable(),
  cost: z.coerce.number().finite().min(0).max(100000),
  outcome: z.enum(["ONGOING", "RECOVERED", "DIED"]),
  notes: z.string().max(500).optional().nullable(),
});

export async function updateTreatmentLogAction(
  raw: z.input<typeof updateTreatmentSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateTreatmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const existing = await db.treatmentLog.findUnique({
      where: { id: parsed.data.id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Treatment log not found." };

    await db.treatmentLog.update({
      where: { id: existing.id },
      data: {
        date: when,
        symptoms: parsed.data.symptoms,
        diagnosis: cleanOpt(parsed.data.diagnosis),
        treatment: parsed.data.treatment,
        dose: cleanOpt(parsed.data.dose),
        cost: parsed.data.cost,
        outcome: parsed.data.outcome as TreatmentOutcome,
        notes: cleanOpt(parsed.data.notes),
      },
    });

    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Treatment log updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteTreatmentLogAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await db.treatmentLog.findUnique({
      where: { id },
      include: { crab: { select: { id: true, currentTrayId: true } } },
    });
    if (!existing) return { ok: false, error: "Treatment log not found." };

    await db.treatmentLog.delete({ where: { id } });
    revalidateCrabRoutes(existing.crab.id, existing.crab.currentTrayId);
    return { ok: true, message: "Treatment log deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- STRONG DELETE: CRAB / BATCH / SALE RECOVERY ----------

export async function deleteCrabAction(raw: {
  crabId: string;
  confirmCode: string;
}): Promise<ActionResult> {
  await requireAuth();
  try {
    const crab = await db.crab.findUnique({
      where: { id: raw.crabId },
      select: { id: true, code: true, currentTrayId: true },
    });
    if (!crab) return { ok: false, error: "Crab not found." };
    if (raw.confirmCode.trim() !== crab.code) {
      return {
        ok: false,
        error: `Confirmation code must match "${crab.code}" exactly.`,
      };
    }

    await db.$transaction(async (tx) => {
      await tx.crab.delete({ where: { id: crab.id } });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath("/trays");
    revalidatePath("/contacts");
    revalidatePath("/reports");
    revalidatePath("/daily");
    if (crab.currentTrayId) revalidatePath(`/trays/${crab.currentTrayId}`);
    return { ok: true, message: `Crab ${crab.code} permanently deleted.` };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteBatchAction(raw: {
  batchId: string;
  confirmLetter: string;
}): Promise<ActionResult> {
  await requireAuth();
  try {
    const batch = await db.batch.findUnique({
      where: { id: raw.batchId },
      include: {
        crabs: { select: { id: true, currentTrayId: true } },
      },
    });
    if (!batch) return { ok: false, error: "Batch not found." };
    if (raw.confirmLetter.trim() !== batch.letter) {
      return {
        ok: false,
        error: `Confirmation text must match "${batch.letter}" exactly.`,
      };
    }

    const trayIds = batch.crabs
      .map((c) => c.currentTrayId)
      .filter((t): t is string => Boolean(t));

    // Delete batch (cascades crabs -> logs/assignments/sales). Settings.nextBatchIndex stays untouched so letters are never reused.
    await db.$transaction(async (tx) => {
      await tx.batch.delete({ where: { id: batch.id } });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath("/trays");
    revalidatePath("/contacts");
    revalidatePath("/reports");
    revalidatePath("/daily");
    for (const tId of trayIds) revalidatePath(`/trays/${tId}`);
    return {
      ok: true,
      message: `Batch ${batch.letter} permanently deleted. Letter ${batch.letter} will never be reused.`,
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const deleteSaleSchema = z.object({
  saleId: z.string().min(1),
  targetTrayId: z.string().min(1, "Select an empty active tray for the crab"),
});

export async function deleteSaleAction(
  raw: z.input<typeof deleteSaleSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = deleteSaleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const now = new Date();
  try {
    let crabId = "";
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: parsed.data.saleId },
        include: {
          crab: {
            include: {
              assignments: { orderBy: { fromDate: "desc" }, take: 1 },
            },
          },
        },
      });
      if (!sale) throw new Error("Sale record not found.");
      crabId = sale.crab.id;

      const tray = await tx.tray.findUnique({
        where: { id: parsed.data.targetTrayId },
        include: { currentCrab: { select: { code: true } } },
      });
      if (!tray) throw new Error("Target tray not found.");
      if (!tray.active) throw new Error(`Tray ${tray.number} is inactive.`);
      if (tray.currentCrab) {
        throw new Error(
          `Tray ${tray.number} is occupied by crab ${tray.currentCrab.code}. Pick another empty tray.`
        );
      }

      const lastAssignment = sale.crab.assignments[0];
      const reason =
        lastAssignment && lastAssignment.trayId === tray.id
          ? "MOVED_BACK"
          : "MOVED_OTHER";

      await tx.sale.delete({ where: { id: sale.id } });

      await tx.crab.update({
        where: { id: sale.crab.id },
        data: {
          status: "ACTIVE",
          endDate: null,
          finalWeightG: null,
          currentTrayId: tray.id,
        },
      });

      await tx.trayAssignment.create({
        data: {
          crabId: sale.crab.id,
          trayId: tray.id,
          fromDate: now,
          toDate: null,
          reason,
        },
      });
    });

    revalidateCrabRoutes(crabId, parsed.data.targetTrayId);
    revalidatePath("/trays");
    revalidatePath("/contacts");
    return {
      ok: true,
      message: "Sale deleted; crab reverted to ACTIVE and placed in tray.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}
