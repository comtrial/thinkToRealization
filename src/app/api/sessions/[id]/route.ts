import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type Params = { params: Promise<{ id: string }> };

// GET /api/sessions/:id — session detail with files and decisions
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        files: { orderBy: { detectedAt: "asc" } },
        decisions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!session) return notFound("Session", id);
    return successResponse(session);
  } catch (error) {
    return handlePrismaError(error);
  }
}
