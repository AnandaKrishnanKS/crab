"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import {
  type ActionResult,
  firstZodError,
  getPrismaErrorMessage,
} from "@/lib/action-result";

const settingsSchema = z
  .object({
    systemVolumeLitres: z.coerce
      .number()
      .finite()
      .positive("System volume must be greater than 0 L")
      .max(1000000),
    waterTestIntervalDays: z.coerce.number().int().min(1).max(365),
    waterChangeWarnDays: z.coerce.number().int().min(1).max(365),
    waterChangeIntervalDays: z.coerce.number().int().min(1).max(365),
    salinityMin: z.coerce.number().finite().min(0).max(50),
    salinityMax: z.coerce.number().finite().min(0).max(50),
    phMin: z.coerce.number().finite().min(4).max(11),
    phMax: z.coerce.number().finite().min(4).max(11),
    ammoniaMax: z.coerce.number().finite().min(0).max(50),
    nitriteMax: z.coerce.number().finite().min(0).max(50),
    nitrateMax: z.coerce.number().finite().min(0).max(500),
    tempMin: z.coerce.number().finite().min(10).max(45),
    tempMax: z.coerce.number().finite().min(10).max(45),
    targetFatteningDays: z.coerce.number().int().min(1).max(365),
    lowMineralStockKg: z.coerce.number().finite().min(0).max(10000),
    softCrabAlert: z.boolean(),
  })
  .refine((d) => d.salinityMin < d.salinityMax, {
    message: "Min salinity must be lower than max salinity.",
  })
  .refine((d) => d.phMin < d.phMax, {
    message: "Min pH must be lower than max pH.",
  })
  .refine((d) => d.tempMin < d.tempMax, {
    message: "Min temperature must be lower than max temperature.",
  })
  .refine((d) => d.waterChangeWarnDays <= d.waterChangeIntervalDays, {
    message: "Water change warning days must be ≤ overdue interval days.",
  });

export async function updateSettingsAction(
  raw: z.input<typeof settingsSchema>
): Promise<ActionResult> {
  await requireAuth();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  try {
    await db.settings.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    });
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/water");
    return { ok: true, message: "RAS thresholds and settings saved." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(4, "New password must be at least 4 characters")
      .max(128),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match.",
  });

export async function changePasswordAction(
  raw: z.input<typeof passwordSchema>
): Promise<ActionResult> {
  const sessionUser = await requireAuth();
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  try {
    const user = await db.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return { ok: false, error: "Account not found." };

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    );
    if (!valid) {
      return { ok: false, error: "Current password is incorrect." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { ok: true, message: "Password updated successfully." };
  } catch (err) {
    return { ok: false, error: getPrismaErrorMessage(err) };
  }
}

