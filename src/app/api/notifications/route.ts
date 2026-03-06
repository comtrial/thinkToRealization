import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const notifications = await prisma.notification.findMany({
      where: { userId: auth.session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return successResponse(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
