import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const count = await prisma.notification.count({
      where: { userId: auth.session.userId, isRead: false },
    });

    return successResponse({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
