import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

    const where: Record<string, unknown> = { userId: auth.session.userId };
    if (unreadOnly) where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return successResponse(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
