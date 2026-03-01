import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  errorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type Params = { params: Promise<{ id: string }> };

// POST /api/sessions/:id/resume — resume a paused/completed session
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return notFound("Session", id);

    if (session.status === "active") {
      return errorResponse(
        "SESSION_ALREADY_ACTIVE",
        "Session is already active",
        409
      );
    }

    // Check no other active session on same node
    const otherActive = await prisma.session.findFirst({
      where: { nodeId: session.nodeId, status: "active", id: { not: id } },
    });
    if (otherActive) {
      return errorResponse(
        "SESSION_ALREADY_ACTIVE",
        `Node already has an active session: ${otherActive.id}`,
        409
      );
    }

    const updated = await prisma.session.update({
      where: { id },
      data: {
        status: "active",
        resumeCount: { increment: 1 },
        endedAt: null,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handlePrismaError(error);
  }
}
