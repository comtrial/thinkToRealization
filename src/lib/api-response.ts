import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { data, meta: { timestamp: new Date().toISOString() } },
    { status }
  );
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message, status } },
    { status }
  );
}

export function validationError(error: ZodError) {
  const message = error.issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
  return errorResponse("VALIDATION_ERROR", message, 400);
}

export function notFound(entity: string, id: string) {
  const code = `${entity.toUpperCase()}_NOT_FOUND`;
  return errorResponse(code, `${entity} with id '${id}' not found`, 404);
}

// Legacy aliases used by old v1 routes
export const validationErrorResponse = (msg: string) =>
  errorResponse("VALIDATION_ERROR", msg, 400);
export const notFoundResponse = (msg: string) =>
  errorResponse("NOT_FOUND", msg, 404);

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return validationError(error);
  }
  console.error("API Error:", error);
  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
}
