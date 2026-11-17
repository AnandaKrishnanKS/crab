"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { parseISTDate } from "@/lib/format";
import {
  type ActionResult,
  firstZodError,
  getPrismaErrorMessage,
} from "@/lib/action-result";
import type { ExpenseCategory } from "@/generated/prisma/client";

function cleanOpt(val: string | null | undefined): string | null {
  const s = val?.trim();
  return s ? s : null;
}

function revalidateExpenseRoutes() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

const expenseSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  category: z.enum(["ELECTRICITY", "LABOUR", "EQUIPMENT", "TRANSPORT", "OTHER"]),
  amount: z.coerce.number().finite().positive("Amount (₹) must be > 0").max(100000000),
  notes: z.string().max(500).optional().nullable(),
});

export async function addExpenseAction(
  raw: z.input<typeof expenseSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const created = await db.expense.create({
      data: {
        date: when,
        category: parsed.data.category as ExpenseCategory,
        amount: Math.round(parsed.data.amount * 100) / 100,
        notes: cleanOpt(parsed.data.notes),
      },
    });
    revalidateExpenseRoutes();
    return {
      ok: true,
      data: { id: created.id },
      message: "Expense logged.",
    };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function updateExpenseAction(
  raw: z.input<typeof expenseSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.id) return { ok: false, error: "Missing expense id." };

  const when = parseISTDate(parsed.data.date);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };

  try {
    await db.expense.update({
      where: { id: parsed.data.id },
      data: {
        date: when,
        category: parsed.data.category as ExpenseCategory,
        amount: Math.round(parsed.data.amount * 100) / 100,
        notes: cleanOpt(parsed.data.notes),
      },
    });
    revalidateExpenseRoutes();
    return { ok: true, message: "Expense updated." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  await requireAuth();
  try {
    await db.expense.delete({ where: { id } });
    revalidateExpenseRoutes();
    return { ok: true, message: "Expense deleted." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

export async function markSalePaidAction(saleId: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const sale = await db.sale.update({
      where: { id: saleId },
      data: { paymentStatus: "PAID" },
      select: { crabId: true },
    });
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/contacts");
    revalidatePath("/crabs");
    revalidatePath(`/crabs/${sale.crabId}`);
    return { ok: true, message: "Sale marked PAID." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

