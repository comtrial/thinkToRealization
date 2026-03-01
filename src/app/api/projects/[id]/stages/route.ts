import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/stages - List stages for project
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return notFoundResponse("프로젝트를 찾을 수 없습니다");
    }

    const stages = await prisma.stage.findMany({
      where: { projectId: id },
      include: {
        decisions: { orderBy: { createdAt: "desc" } },
        sessions: { orderBy: { updatedAt: "desc" } },
      },
      orderBy: { orderIndex: "asc" },
    });

    return successResponse(stages);
  } catch (error) {
    console.error("GET /api/projects/[id]/stages error:", error);
    return handlePrismaError(error);
  }
}
