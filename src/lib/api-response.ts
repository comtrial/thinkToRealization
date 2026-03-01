import { NextResponse } from "next/server";
import { ERROR_CODES } from "./constants";

type ApiError = {
  code: string;
  message: string;
};

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function errorResponse(
  message: string,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  status = 500
) {
  const error: ApiError = { code, message };
  return NextResponse.json({ data: null, error }, { status });
}

export function notFoundResponse(message = "리소스를 찾을 수 없습니다") {
  return errorResponse(message, ERROR_CODES.NOT_FOUND, 404);
}

export function validationErrorResponse(message: string) {
  return errorResponse(message, ERROR_CODES.VALIDATION_ERROR, 400);
}
