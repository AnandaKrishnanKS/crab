import type { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; blockedByHistory?: boolean };

export function firstZodError(error: ZodError): string {
  return error.issues[0]?.message ?? "Please check the entered values.";
}

export function getPrismaErrorMessage(
  err: unknown,
  duplicateMessage = "A record with this unique value already exists."
): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return duplicateMessage;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

