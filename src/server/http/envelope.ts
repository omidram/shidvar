import { z } from "zod";

export type ApiMeta = Record<string, unknown> | undefined;

export function ok<T>(data: T, message: string | null = null, meta?: ApiMeta) {
  return { success: true as const, data, message, meta: meta ?? {} };
}

export function fail(code: string, message: string, fields?: Record<string, string[]>) {
  return {
    success: false as const,
    error: { code, message, fields: fields ?? {} },
  };
}

export function zodFields(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    fields[key] = fields[key] ?? [];
    fields[key].push(issue.message);
  }
  return fields;
}
