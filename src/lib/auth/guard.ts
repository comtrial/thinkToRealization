import { getIronSession } from "iron-session";
import { NextRequest, NextResponse } from "next/server";
import { sessionOptions, type SessionData } from "./session";
import { errorResponse } from "../api-response";
import { prisma } from "../prisma";

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

const TEST_USER = {
  userId: "test-user-id",
  email: "test@test.local",
  name: "Test User",
} as const;

let testUserEnsured = false;

async function ensureTestUser() {
  if (testUserEnsured) return;
  await prisma.user.upsert({
    where: { id: TEST_USER.userId },
    update: {},
    create: {
      id: TEST_USER.userId,
      email: TEST_USER.email,
      name: TEST_USER.name,
      passwordHash: "test-bypass",
    },
  });
  testUserEnsured = true;
}

/**
 * Extracts and validates session from API request.
 * Returns session data or a 401 error response.
 * In test mode (BYPASS_AUTH=true), returns a mock session.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ session: SessionData; response?: never } | { session?: never; response: NextResponse }> {
  if (BYPASS_AUTH) {
    await ensureTestUser();
    return { session: TEST_USER };
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.userId) {
    return { response: errorResponse("UNAUTHORIZED", "로그인이 필요합니다", 401) };
  }

  return { session: { userId: session.userId, email: session.email, name: session.name } };
}
