import { getIronSession } from "iron-session";
import { NextRequest, NextResponse } from "next/server";
import { sessionOptions, type SessionData } from "./session";
import { errorResponse } from "../api-response";

/**
 * Extracts and validates session from API request.
 * Returns session data or a 401 error response.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ session: SessionData; response?: never } | { session?: never; response: NextResponse }> {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.userId) {
    return { response: errorResponse("UNAUTHORIZED", "로그인이 필요합니다", 401) };
  }

  return { session: { userId: session.userId, email: session.email, name: session.name } };
}
