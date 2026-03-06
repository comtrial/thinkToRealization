import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db/client";
import { loginSchema } from "@/lib/schemas/auth";
import { verifyPassword } from "@/lib/auth/password";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { handleApiError, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true, email: true, name: true, avatarUrl: true, passwordHash: true, createdAt: true },
    });

    if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
      return errorResponse("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 일치하지 않습니다", 401);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _hash, ...safeUser } = user;

    const res = NextResponse.json(
      { data: safeUser, meta: { timestamp: new Date().toISOString() } },
      { status: 200 }
    );
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    await session.save();

    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
