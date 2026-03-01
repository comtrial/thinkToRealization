import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

// GET /api/recovery/sessions — find active sessions for recovery
export async function GET() {
  try {
    const activeSessions = await prisma.session.findMany({
      where: { status: "active" },
      include: {
        node: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: { select: { title: true, slug: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return successResponse(activeSessions);
  } catch (error) {
    return handlePrismaError(error);
  }
}
