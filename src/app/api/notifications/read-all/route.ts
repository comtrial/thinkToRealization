import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    await prisma.notification.updateMany({
      where: { userId: auth.session.userId, isRead: false },
      data: { isRead: true },
    });

    return successResponse({ message: "모든 알림을 읽음 처리했습니다" });
  } catch (error) {
    return handleApiError(error);
  }
}
