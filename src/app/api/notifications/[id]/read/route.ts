import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError, notFound } from "@/lib/api-response";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id } = await params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== auth.session.userId) {
      return notFound("Notification", id);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
