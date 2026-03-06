import { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { successResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const res = successResponse({ message: "로그아웃되었습니다" });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  return res;
}
