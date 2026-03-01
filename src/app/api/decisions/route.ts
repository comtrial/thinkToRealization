import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { ACTIVITY_TYPES } from "@/lib/constants";

// POST /api/decisions - Create decision with transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stageId, sessionId, content, context } = body;

    if (!stageId) {
      return validationErrorResponse("stageId는 필수입니다");
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return validationErrorResponse("content는 필수입니다");
    }

    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: { project: true },
    });
    if (!stage) {
      return notFoundResponse("단계를 찾을 수 없습니다");
    }

    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        return notFoundResponse("세션을 찾을 수 없습니다");
      }
    }

    const decision = await prisma.$transaction(async (tx) => {
      const newDecision = await tx.decision.create({
        data: {
          stageId,
          sessionId: sessionId || null,
          content: content.trim(),
          context: context?.trim() || null,
        },
      });

      await tx.activity.create({
        data: {
          projectId: stage.projectId,
          stageId,
          activityType: ACTIVITY_TYPES.DECISION_CREATED,
          description: `"${stage.name}" 단계에 결정사항 추가`,
        },
      });

      await tx.project.update({
        where: { id: stage.projectId },
        data: { updatedAt: new Date() },
      });

      return newDecision;
    });

    return successResponse(decision, 201);
  } catch (error) {
    console.error("POST /api/decisions error:", error);
    return handlePrismaError(error);
  }
}
