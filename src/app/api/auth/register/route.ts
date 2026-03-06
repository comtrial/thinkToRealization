import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db/client";
import { registerSchema } from "@/lib/schemas/auth";
import { hashPassword } from "@/lib/auth/password";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { handleApiError, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) {
      return errorResponse("EMAIL_EXISTS", "이미 사용 중인 이메일입니다", 409);
    }

    const passwordHash = await hashPassword(parsed.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        passwordHash,
      },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });

    // Set session cookie
    const res = NextResponse.json(
      { data: user, meta: { timestamp: new Date().toISOString() } },
      { status: 201 }
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
