import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { errorResponse } from "./api-response";

export function handlePrismaError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const fields = (error.meta?.target as string[]) ?? [];
        return errorResponse(
          "CONFLICT",
          `Duplicate value: ${fields.join(", ")}`,
          409
        );
      }
      case "P2025":
        return errorResponse("NOT_FOUND", "Record not found", 404);
      case "P2003":
        return errorResponse(
          "VALIDATION_ERROR",
          "Referenced resource does not exist",
          400
        );
      case "P2022": {
        const column = (error.meta?.column as string) ?? "unknown";
        return errorResponse(
          "SCHEMA_MISMATCH",
          `Column '${column}' not found. Run 'npx prisma migrate dev' to update the database schema.`,
          500
        );
      }
      default:
        return errorResponse("DB_WRITE_FAILED", `Database error: ${error.code}`, 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse("VALIDATION_ERROR", "Invalid data format", 400);
  }

  return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
}
