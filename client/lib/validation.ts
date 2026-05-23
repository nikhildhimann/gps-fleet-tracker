"use client";

import { ZodError, ZodSchema } from "zod";

export type FieldErrorMap = Record<string, string>;

export function validateWithZod<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: FieldErrorMap } {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: FieldErrorMap = {};
  const zodError = parsed.error as ZodError;
  for (const issue of zodError.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
