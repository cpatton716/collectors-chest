import { NextResponse } from "next/server";
import { z, ZodError, ZodSchema } from "zod";

export interface ValidationErrorDetail {
  field: string;
  issue: string;
}

export interface ValidationErrorResponse {
  error: string;
  details: ValidationErrorDetail[];
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse<ValidationErrorResponse> };

function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    issue: issue.message,
  }));
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      { error: "Invalid request body", details: formatZodErrors(parsed.error) },
      { status: 400 }
    ),
  };
}

export function validateQuery<T>(
  schema: ZodSchema<T>,
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): ValidationResult<T> {
  const obj =
    searchParams instanceof URLSearchParams ? Object.fromEntries(searchParams.entries()) : searchParams;
  const parsed = schema.safeParse(obj);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      { error: "Invalid query parameters", details: formatZodErrors(parsed.error) },
      { status: 400 }
    ),
  };
}

export function validateParams<T>(schema: ZodSchema<T>, params: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(params);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      { error: "Invalid URL parameters", details: formatZodErrors(parsed.error) },
      { status: 400 }
    ),
  };
}

export const schemas = {
  uuid: z.string().uuid("Must be a valid UUID"),
  email: z.string().email("Must be a valid email address"),
  url: z.string().url("Must be a valid URL"),
  positiveInt: z.coerce.number().int().positive("Must be a positive integer"),
  nonNegativeNumber: z.coerce.number().nonnegative("Must be zero or positive"),
  trimmedString: (min = 1, max = 500) =>
    z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(min).max(max)),
};
