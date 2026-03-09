import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      return errorResponse("USER_NOT_FOUND", "사용자를 찾을 수 없습니다", 404);
    }

    return successResponse(user);
  } catch {
    return errorResponse("INTERNAL_ERROR", "서버 오류가 발생했습니다", 500);
  }
}
