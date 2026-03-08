import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  userId: string;
  email: string;
  name: string;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.IRON_SESSION_PASSWORD ??
    "devflow-local-dev-secret-at-least-32-chars-long!!",
  cookieName: "ttr-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSessionFromCookies(): Promise<SessionData & { destroy: () => void }> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse
): Promise<SessionData & { save: () => Promise<void>; destroy: () => void }> {
  return getIronSession<SessionData>(req, res, sessionOptions);
}
