import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { PROJECT_STATUS } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id] - Get project with stages and decisions
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            decisions: { orderBy: { createdAt: "desc" } },
          },
        },
        activities: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) {
      return notFoundResponse("프로젝트를 찾을 수 없습니다");
    }

    return successResponse(project);
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return handlePrismaError(error);
  }
}

// PATCH /api/projects/[id] - Update name, description, status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, status } = body;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("프로젝트를 찾을 수 없습니다");
    }

    if (
      status &&
      !(Object.values(PROJECT_STATUS) as string[]).includes(status)
    ) {
      return validationErrorResponse(
        `유효하지 않은 상태입니다: ${status}`
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(status !== undefined && { status }),
      },
      include: {
        stages: { orderBy: { orderIndex: "asc" } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return handlePrismaError(error);
  }
}

// DELETE /api/projects/[id] - Cascade delete
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("프로젝트를 찾을 수 없습니다");
    }

    await prisma.project.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return handlePrismaError(error);
  }
}
