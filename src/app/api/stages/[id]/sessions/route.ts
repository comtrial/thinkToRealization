import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { ACTIVITY_TYPES } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/stages/[id]/sessions - List sessions for stage
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const stage = await prisma.stage.findUnique({ where: { id } });
    if (!stage) {
      return notFoundResponse("단계를 찾을 수 없습니다");
    }

    const sessions = await prisma.session.findMany({
      where: { stageId: id },
      include: {
        decisions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return successResponse(sessions);
  } catch (error) {
    console.error("GET /api/stages/[id]/sessions error:", error);
    return handlePrismaError(error);
  }
}

// POST /api/stages/[id]/sessions - Create new session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { title } = body;

    const stage = await prisma.stage.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!stage) {
      return notFoundResponse("단계를 찾을 수 없습니다");
    }

    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({
        data: {
          stageId: id,
          title: title?.trim() || null,
        },
      });

      await tx.activity.create({
        data: {
          projectId: stage.projectId,
          stageId: id,
          activityType: ACTIVITY_TYPES.SESSION_CREATED,
          description: `"${stage.name}" 단계에 새 세션 생성`,
        },
      });

      await tx.project.update({
        where: { id: stage.projectId },
        data: { updatedAt: new Date() },
      });

      return newSession;
    });

    return successResponse(session, 201);
  } catch (error) {
    console.error("POST /api/stages/[id]/sessions error:", error);
    return handlePrismaError(error);
  }
}
