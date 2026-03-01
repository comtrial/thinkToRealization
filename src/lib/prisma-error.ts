import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { errorResponse, notFoundResponse } from "./api-response";
import { ERROR_CODES } from "./constants";

/**
 * Maps Prisma error codes to API responses.
 * Call this in catch blocks to handle known Prisma errors gracefully.
 */
export function handlePrismaError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        // Unique constraint violation
        const fields = (error.meta?.target as string[]) ?? [];
        return errorResponse(
          `중복된 값이 존재합니다: ${fields.join(", ")}`,
          ERROR_CODES.CONFLICT,
          409
        );
      }
      case "P2025":
        // Record not found
        return notFoundResponse("요청한 리소스를 찾을 수 없습니다");
      case "P2003":
        // Foreign key constraint violation
        return errorResponse(
          "참조하는 리소스가 존재하지 않습니다",
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      case "P2014":
        // Required relation violation
        return errorResponse(
          "필수 관계 데이터가 누락되었습니다",
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      default:
        return errorResponse(
          `데이터베이스 오류: ${error.code}`,
          ERROR_CODES.INTERNAL_ERROR,
          500
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(
      "잘못된 데이터 형식입니다",
      ERROR_CODES.VALIDATION_ERROR,
      400
    );
  }

  // Unknown error
  return errorResponse("서버 내부 오류가 발생했습니다");
}
