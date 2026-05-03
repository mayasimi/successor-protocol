import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import { ApiError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail(400, "validation_error", "Request validation failed", error.flatten());
  }

  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  const message = error instanceof Error ? error.message : "Unknown server error";
  return fail(500, "server_error", message);
}
