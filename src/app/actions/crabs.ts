"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { indexToBatchLetter, formatCrabCode } from "@/lib/batch";
import { parseISTDate, toNumber } from "@/lib/format";
import {
  type ActionResult,
  firstZodError,
  getPrismaErrorMessage,
} from "@/lib/action-result";
import type {
  PaymentStatus,
  Sex,
  TrayAssignmentReason,
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

// ---------- CREATE BATCH ----------

const batchCrabRowSchema = z.object({
  trayId: z.string().min(1, "Select an empty tray for each crab"),
  sex: z.enum(["MALE", "FEMALE"]),
  initialWeightG: z.coerce
    .number()
    .finite()
    .positive("Initial weight must be greater than 0 g")
    .max(5000),
  purchaseCost: z.coerce
    .number()
    .finite()
    .min(0, "Purchase cost cannot be negative")
    .max(100000),
  notes: z.string().max(400).optional().nullable(),
});

const createBatchSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  pricePerKg: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  expectedHarvestDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  crabs: z.array(batchCrabRowSchema).min(1, "Add at least one crab to the batch"),
});

export async function createBatchAction(
  raw: z.input<typeof createBatchSchema>
): Promise<ActionResult<{ batchId: string; letter: string; codes: string[] }>> {
  await requireAuth();
  const parsed = createBatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const trayIds = parsed.data.crabs.map((c) => c.trayId);
  if (new Set(trayIds).size !== trayIds.length) {
    return { ok: false, error: "Each crab in the batch must be placed in a different tray." };
  }

  const pricePerKgNum = parseOptionalNumber(parsed.data.pricePerKg);
  if (pricePerKgNum !== null && pricePerKgNum < 0) {
    return { ok: false, error: "Price per kg cannot be negative." };
  }

  const stockedDate = parseISTDate(parsed.data.purchaseDate);
  if (Number.isNaN(stockedDate.getTime())) {
    return { ok: false, error: "Invalid purchase date." };
  }

  const expectedHarvestDate = parsed.data.expectedHarvestDate?.trim()
    ? parseISTDate(parsed.data.expectedHarvestDate)
    : null;

  try {
    const result = await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: parsed.data.supplierId },
      });
      if (!supplier) {
        throw new Error("Selected supplier not found.");
      }

      const trays = await tx.tray.findMany({
        where: { id: { in: trayIds } },
        include: { currentCrab: { select: { code: true } } },
      });
      if (trays.length !== trayIds.length) {
        throw new Error("One or more selected trays were not found.");
      }
      for (const tray of trays) {
        if (!tray.active) {
          throw new Error(`Tray ${tray.number} is inactive and cannot be stocked.`);
        }
        if (tray.currentCrab) {
          throw new Error(
            `Tray ${tray.number} is already occupied by crab ${tray.currentCrab.code}.`
          );
        }
      }

      await tx.settings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });

      const updatedSettings = await tx.settings.update({
        where: { id: 1 },
        data: { nextBatchIndex: { increment: 1 } },
      });
      const batchIndex = updatedSettings.nextBatchIndex - 1;
      const letter = indexToBatchLetter(batchIndex);

      const batch = await tx.batch.create({
        data: {
          letter,
          supplierId: supplier.id,
          purchaseDate: stockedDate,
          pricePerKg: pricePerKgNum,
          nextCrabSeq: 1 + parsed.data.crabs.length,
          notes: cleanOpt(parsed.data.notes),
        },
      });

      const codes: string[] = [];
      for (let idx = 0; idx < parsed.data.crabs.length; idx++) {
        const row = parsed.data.crabs[idx];
        const seq = idx + 1;
        const code = formatCrabCode(letter, seq);
        codes.push(code);

        const crab = await tx.crab.create({
          data: {
            code,
            batchId: batch.id,
            seq,
            sex: row.sex as Sex,
            initialWeightG: row.initialWeightG,
            purchaseCost: row.purchaseCost,
            stockedDate,
            expectedHarvestDate,
            status: "ACTIVE",
            currentTrayId: row.trayId,
            notes: cleanOpt(row.notes),
          },
        });

        await tx.trayAssignment.create({
          data: {
            crabId: crab.id,
            trayId: row.trayId,
            fromDate: stockedDate,
            toDate: null,
            reason: "STOCKED",
          },
        });
      }

      return { batchId: batch.id, letter, codes };
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath("/trays");
    revalidatePath("/contacts");
    revalidatePath("/batches/new");
    for (const id of trayIds) revalidatePath(`/trays/${id}`);

    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: getPrismaErrorMessage(err, "Batch creation conflicted. Please retry."),
    };
  }
}

// ---------- ADD CRAB TO EXISTING BATCH ----------

const addCrabToBatchSchema = z.object({
  batchId: z.string().min(1, "Select an existing batch"),
  trayId: z.string().min(1, "Select an empty tray"),
  sex: z.enum(["MALE", "FEMALE"]),
  initialWeightG: z.coerce.number().finite().positive().max(5000),
  purchaseCost: z.coerce.number().finite().min(0).max(100000),
  stockedDate: z.string().min(1, "Stocked date is required"),
  expectedHarvestDate: z.string().optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

export async function addCrabToBatchAction(
  raw: z.input<typeof addCrabToBatchSchema>
): Promise<ActionResult<{ id: string; code: string }>> {
  await requireAuth();
  const parsed = addCrabToBatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const stockedDate = parseISTDate(parsed.data.stockedDate);
  const expectedHarvestDate = parsed.data.expectedHarvestDate?.trim()
    ? parseISTDate(parsed.data.expectedHarvestDate)
    : null;

  try {
    const created = await db.$transaction(async (tx) => {
      const tray = await tx.tray.findUnique({
        where: { id: parsed.data.trayId },
        include: { currentCrab: { select: { code: true } } },
      });
      if (!tray) throw new Error("Selected tray not found.");
      if (!tray.active) throw new Error(`Tray ${tray.number} is inactive.`);
      if (tray.currentCrab) {
        throw new Error(`Tray ${tray.number} is occupied by crab ${tray.currentCrab.code}.`);
      }

      const updatedBatch = await tx.batch.update({
        where: { id: parsed.data.batchId },
        data: { nextCrabSeq: { increment: 1 } },
      });
      const seq = updatedBatch.nextCrabSeq - 1;
      const code = formatCrabCode(updatedBatch.letter, seq);

      const crab = await tx.crab.create({
        data: {
          code,
          batchId: updatedBatch.id,
          seq,
          sex: parsed.data.sex as Sex,
          initialWeightG: parsed.data.initialWeightG,
          purchaseCost: parsed.data.purchaseCost,
          stockedDate,
          expectedHarvestDate,
          status: "ACTIVE",
          currentTrayId: tray.id,
          notes: cleanOpt(parsed.data.notes),
        },
      });

      await tx.trayAssignment.create({
        data: {
          crabId: crab.id,
          trayId: tray.id,
          fromDate: stockedDate,
          toDate: null,
          reason: "STOCKED",
        },
      });

      return { id: crab.id, code };
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath("/trays");
    revalidatePath(`/trays/${parsed.data.trayId}`);
    revalidatePath("/contacts");
    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- EDIT INITIAL DETAILS (CODE LOCKED) ----------

const updateCrabSchema = z.object({
  crabId: z.string().min(1),
  supplierId: z.string().min(1, "Select a supplier"),
  sex: z.enum(["MALE", "FEMALE"]),
  initialWeightG: z.coerce.number().finite().positive().max(5000),
  purchaseCost: z.coerce.number().finite().min(0).max(100000),
  stockedDate: z.string().min(1, "Stocked date is required"),
  expectedHarvestDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function updateCrabInitialDetailsAction(
  raw: z.input<typeof updateCrabSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateCrabSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const stockedDate = parseISTDate(parsed.data.stockedDate);
  const expectedHarvestDate = parsed.data.expectedHarvestDate?.trim()
    ? parseISTDate(parsed.data.expectedHarvestDate)
    : null;

  try {
    await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({
        where: { id: parsed.data.crabId },
        include: {
          batch: true,
          assignments: { orderBy: { fromDate: "asc" }, take: 1 },
        },
      });
      if (!crab) throw new Error("Crab not found.");

      if (crab.batch.supplierId !== parsed.data.supplierId) {
        await tx.batch.update({
          where: { id: crab.batchId },
          data: { supplierId: parsed.data.supplierId },
        });
      }

      await tx.crab.update({
        where: { id: crab.id },
        data: {
          sex: parsed.data.sex as Sex,
          initialWeightG: parsed.data.initialWeightG,
          purchaseCost: parsed.data.purchaseCost,
          stockedDate,
          expectedHarvestDate,
          notes: cleanOpt(parsed.data.notes),
        },
      });

      const firstAssignment = crab.assignments[0];
      if (
        firstAssignment &&
        firstAssignment.reason === "STOCKED" &&
        (firstAssignment.toDate === null || stockedDate <= firstAssignment.toDate)
      ) {
        await tx.trayAssignment.update({
          where: { id: firstAssignment.id },
          data: { fromDate: stockedDate },
        });
      }
    });

    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/crabs");
    revalidatePath("/contacts");
    revalidatePath("/trays");
    return { ok: true, message: "Crab details updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MOVE TRAY ----------

const moveTraySchema = z.object({
  crabId: z.string().min(1),
  newTrayId: z.string().min(1, "Select destination tray"),
  reason: z.enum(["MOVED_TO_TREATMENT", "MOVED_BACK", "MOVED_OTHER"]),
  moveDate: z.string().optional(),
});

export async function moveCrabTrayAction(
  raw: z.input<typeof moveTraySchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = moveTraySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parsed.data.moveDate?.trim()
    ? parseISTDate(parsed.data.moveDate)
    : new Date();

  try {
    let oldTrayId: string | null = null;
    await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({ where: { id: parsed.data.crabId } });
      if (!crab) throw new Error("Crab not found.");
      if (crab.status !== "ACTIVE" && crab.status !== "SICK") {
        throw new Error("Only ACTIVE or SICK crabs can be moved.");
      }
      if (crab.currentTrayId === parsed.data.newTrayId) {
        throw new Error("Crab is already in that tray.");
      }
      oldTrayId = crab.currentTrayId;

      const target = await tx.tray.findUnique({
        where: { id: parsed.data.newTrayId },
        include: { currentCrab: { select: { code: true } } },
      });
      if (!target) throw new Error("Target tray not found.");
      if (!target.active) throw new Error(`Tray ${target.number} is inactive.`);
      if (target.currentCrab) {
        throw new Error(`Tray ${target.number} is occupied by ${target.currentCrab.code}.`);
      }

      await tx.trayAssignment.updateMany({
        where: { crabId: crab.id, toDate: null },
        data: { toDate: when },
      });

      await tx.trayAssignment.create({
        data: {
          crabId: crab.id,
          trayId: target.id,
          fromDate: when,
          toDate: null,
          reason: parsed.data.reason as TrayAssignmentReason,
        },
      });

      await tx.crab.update({
        where: { id: crab.id },
        data: { currentTrayId: target.id },
      });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/trays");
    revalidatePath(`/trays/${parsed.data.newTrayId}`);
    if (oldTrayId) revalidatePath(`/trays/${oldTrayId}`);
    return { ok: true, message: "Crab moved to new tray." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MARK SICK + TREATMENTS + RECOVER ----------

const markSickSchema = z.object({
  crabId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  symptoms: z.string().trim().min(1, "Symptoms are required").max(400),
  diagnosis: z.string().max(400).optional().nullable(),
  treatment: z.string().trim().min(1, "Treatment / medicine is required").max(400),
  dose: z.string().max(200).optional().nullable(),
  cost: z.coerce.number().finite().min(0).max(100000),
  notes: z.string().max(500).optional().nullable(),
  moveToTrayId: z.string().optional().nullable(),
});

export async function markCrabSickAction(
  raw: z.input<typeof markSickSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = markSickSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  const moveToTrayId = cleanOpt(parsed.data.moveToTrayId);

  try {
    let oldTrayId: string | null = null;
    await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({ where: { id: parsed.data.crabId } });
      if (!crab) throw new Error("Crab not found.");
      if (crab.status !== "ACTIVE") {
        throw new Error("Only ACTIVE crabs can be marked SICK.");
      }
      oldTrayId = crab.currentTrayId;

      let nextTrayId = crab.currentTrayId;
      if (moveToTrayId && moveToTrayId !== crab.currentTrayId) {
        const target = await tx.tray.findUnique({
          where: { id: moveToTrayId },
          include: { currentCrab: { select: { code: true } } },
        });
        if (!target || !target.active) throw new Error("Selected tray is not active.");
        if (target.currentCrab) {
          throw new Error(`Tray ${target.number} is occupied by ${target.currentCrab.code}.`);
        }

        await tx.trayAssignment.updateMany({
          where: { crabId: crab.id, toDate: null },
          data: { toDate: when },
        });
        await tx.trayAssignment.create({
          data: {
            crabId: crab.id,
            trayId: target.id,
            fromDate: when,
            toDate: null,
            reason: "MOVED_TO_TREATMENT",
          },
        });
        nextTrayId = target.id;
      }

      await tx.crab.update({
        where: { id: crab.id },
        data: { status: "SICK", currentTrayId: nextTrayId },
      });

      await tx.treatmentLog.create({
        data: {
          crabId: crab.id,
          date: when,
          symptoms: parsed.data.symptoms,
          diagnosis: cleanOpt(parsed.data.diagnosis),
          treatment: parsed.data.treatment,
          dose: cleanOpt(parsed.data.dose),
          cost: parsed.data.cost,
          outcome: "ONGOING",
          notes: cleanOpt(parsed.data.notes),
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/trays");
    revalidatePath("/daily");
    if (oldTrayId) revalidatePath(`/trays/${oldTrayId}`);
    if (moveToTrayId) revalidatePath(`/trays/${moveToTrayId}`);
    return { ok: true, message: "Crab marked SICK and treatment started." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const addTreatmentSchema = z.object({
  crabId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  symptoms: z.string().trim().min(1, "Symptoms are required").max(400),
  diagnosis: z.string().max(400).optional().nullable(),
  treatment: z.string().trim().min(1, "Treatment / medicine is required").max(400),
  dose: z.string().max(200).optional().nullable(),
  cost: z.coerce.number().finite().min(0).max(100000),
  outcome: z.enum(["ONGOING", "RECOVERED", "DIED"]),
  notes: z.string().max(500).optional().nullable(),
});

export async function addTreatmentAction(
  raw: z.input<typeof addTreatmentSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = addTreatmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  try {
    const crab = await db.crab.findUnique({ where: { id: parsed.data.crabId } });
    if (!crab) return { ok: false, error: "Crab not found." };

    await db.treatmentLog.create({
      data: {
        crabId: crab.id,
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

    revalidatePath(`/crabs/${crab.id}`);
    return { ok: true, message: "Treatment entry logged." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const recoverSchema = z.object({
  crabId: z.string().min(1),
  date: z.string().min(1, "Recovery date is required"),
  moveToTrayId: z.string().optional().nullable(),
});

export async function markCrabRecoveredAction(
  raw: z.input<typeof recoverSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = recoverSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  const moveToTrayId = cleanOpt(parsed.data.moveToTrayId);

  try {
    let oldTrayId: string | null = null;
    await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({ where: { id: parsed.data.crabId } });
      if (!crab) throw new Error("Crab not found.");
      if (crab.status !== "SICK") {
        throw new Error("Only SICK crabs can be marked recovered.");
      }
      oldTrayId = crab.currentTrayId;

      let nextTrayId = crab.currentTrayId;
      if (moveToTrayId && moveToTrayId !== crab.currentTrayId) {
        const target = await tx.tray.findUnique({
          where: { id: moveToTrayId },
          include: { currentCrab: { select: { code: true } } },
        });
        if (!target || !target.active) throw new Error("Selected tray is not active.");
        if (target.currentCrab) {
          throw new Error(`Tray ${target.number} is occupied by ${target.currentCrab.code}.`);
        }

        await tx.trayAssignment.updateMany({
          where: { crabId: crab.id, toDate: null },
          data: { toDate: when },
        });
        await tx.trayAssignment.create({
          data: {
            crabId: crab.id,
            trayId: target.id,
            fromDate: when,
            toDate: null,
            reason: "MOVED_BACK",
          },
        });
        nextTrayId = target.id;
      }

      await tx.crab.update({
        where: { id: crab.id },
        data: { status: "ACTIVE", currentTrayId: nextTrayId },
      });

      await tx.treatmentLog.updateMany({
        where: { crabId: crab.id, outcome: "ONGOING" },
        data: { outcome: "RECOVERED" },
      });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/trays");
    revalidatePath("/daily");
    if (oldTrayId) revalidatePath(`/trays/${oldTrayId}`);
    if (moveToTrayId) revalidatePath(`/trays/${moveToTrayId}`);
    return { ok: true, message: "Crab recovered and returned to ACTIVE." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- MARK DEAD ----------

const markDeadSchema = z.object({
  crabId: z.string().min(1),
  endDate: z.string().min(1, "Date of death is required"),
  deathCause: z.string().max(300).optional().nullable(),
  finalWeightG: z.union([z.string(), z.number(), z.null(), z.undefined()]),
  notes: z.string().max(500).optional().nullable(),
});

export async function markCrabDeadAction(
  raw: z.input<typeof markDeadSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = markDeadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const endDate = parseISTDate(parsed.data.endDate);
  const finalWeight = parseOptionalNumber(parsed.data.finalWeightG);
  if (finalWeight !== null && finalWeight <= 0) {
    return { ok: false, error: "Final weight must be greater than 0 g." };
  }

  try {
    let freedTrayId: string | null = null;
    await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({ where: { id: parsed.data.crabId } });
      if (!crab) throw new Error("Crab not found.");
      if (crab.status !== "ACTIVE" && crab.status !== "SICK") {
        throw new Error("Crab is already closed (SOLD or DEAD).");
      }
      freedTrayId = crab.currentTrayId;

      await tx.trayAssignment.updateMany({
        where: { crabId: crab.id, toDate: null },
        data: { toDate: endDate },
      });

      await tx.treatmentLog.updateMany({
        where: { crabId: crab.id, outcome: "ONGOING" },
        data: { outcome: "DIED" },
      });

      const appendedNotes = cleanOpt(parsed.data.notes);
      const nextNotes = appendedNotes
        ? crab.notes
          ? `${crab.notes}\nMortality note: ${appendedNotes}`
          : appendedNotes
        : crab.notes;

      await tx.crab.update({
        where: { id: crab.id },
        data: {
          status: "DEAD",
          endDate,
          currentTrayId: null,
          deathCause: cleanOpt(parsed.data.deathCause),
          finalWeightG: finalWeight,
          notes: nextNotes,
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/trays");
    revalidatePath("/daily");
    revalidatePath("/reports");
    if (freedTrayId) revalidatePath(`/trays/${freedTrayId}`);
    return { ok: true, message: "Crab marked DEAD and tray freed." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

// ---------- SELL CRAB ----------

const sellCrabSchema = z.object({
  crabId: z.string().min(1),
  buyerId: z.string().min(1, "Select a buyer"),
  date: z.string().min(1, "Sale date is required"),
  weightG: z.coerce.number().finite().positive("Sale weight must be > 0 g").max(5000),
  pricePerKg: z.coerce.number().finite().positive("Price per kg must be > ₹0").max(100000),
  totalAmount: z.coerce.number().finite().min(0).max(500000),
  paymentStatus: z.enum(["PAID", "PENDING"]),
});

export async function sellCrabAction(
  raw: z.input<typeof sellCrabSchema>
): Promise<ActionResult<{ saleId: string }>> {
  await requireAuth();
  const parsed = sellCrabSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const saleDate = parseISTDate(parsed.data.date);

  try {
    let freedTrayId: string | null = null;
    const sale = await db.$transaction(async (tx) => {
      const crab = await tx.crab.findUnique({
        where: { id: parsed.data.crabId },
        include: { sale: true },
      });
      if (!crab) throw new Error("Crab not found.");
      if (crab.status !== "ACTIVE") {
        throw new Error(
          crab.status === "SICK"
            ? "Mark the crab RECOVERED before selling."
            : "Only ACTIVE crabs can be sold."
        );
      }
      if (crab.sale) throw new Error("This crab already has a recorded sale.");

      const buyer = await tx.buyer.findUnique({
        where: { id: parsed.data.buyerId },
      });
      if (!buyer) throw new Error("Selected buyer not found.");

      freedTrayId = crab.currentTrayId;

      const createdSale = await tx.sale.create({
        data: {
          crabId: crab.id,
          buyerId: buyer.id,
          date: saleDate,
          weightG: parsed.data.weightG,
          pricePerKg: parsed.data.pricePerKg,
          totalAmount: parsed.data.totalAmount,
          paymentStatus: parsed.data.paymentStatus as PaymentStatus,
        },
      });

      await tx.trayAssignment.updateMany({
        where: { crabId: crab.id, toDate: null },
        data: { toDate: saleDate },
      });

      await tx.crab.update({
        where: { id: crab.id },
        data: {
          status: "SOLD",
          endDate: saleDate,
          finalWeightG: parsed.data.weightG,
          currentTrayId: null,
        },
      });

      return createdSale;
    });

    revalidatePath("/");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${parsed.data.crabId}`);
    revalidatePath("/trays");
    revalidatePath("/contacts");
    revalidatePath("/daily");
    revalidatePath("/reports");
    if (freedTrayId) revalidatePath(`/trays/${freedTrayId}`);
    return {
      ok: true,
      data: { saleId: sale.id },
      message: `Sale recorded (${toNumber(sale.totalAmount)} INR) and tray freed.`,
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

