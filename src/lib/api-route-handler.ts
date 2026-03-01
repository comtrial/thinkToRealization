import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "./api-response";

/**
 * Wraps an API route handler with error boundary.
 * Catches unhandled errors and returns a standardized error response.
 */
export function apiHandler(
  handler: (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
