import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import {
  STAGE_STATUS,
  ACTIVITY_TYPES,
  ERROR_CODES,
} from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/stages/[id]/transition - Stage transition transaction
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { summary, direction, targetStageId } = body;

    if (!direction || !["next", "previous", "jump"].includes(direction)) {
      return validationErrorResponse(
        "direction은 next, previous, jump 중 하나여야 합니다"
      );
    }

    if (direction === "jump" && !targetStageId) {
      return validationErrorResponse(
        "jump 방향에는 targetStageId가 필요합니다"
      );
    }

    // All reads + writes inside a single transaction for concurrency safety
    const result = await prisma.$transaction(async (tx) => {
      const currentStage = await tx.stage.findUnique({
        where: { id },
        include: { project: true },
      });

      if (!currentStage) {
        throw { __apiError: true, response: notFoundResponse("단계를 찾을 수 없습니다") };
      }

      // Optimistic locking: verify the stage is still active inside the transaction
      if (currentStage.status !== STAGE_STATUS.ACTIVE) {
        throw {
          __apiError: true,
          response: errorResponse(
            "현재 활성 상태인 단계만 전환할 수 있습니다",
            ERROR_CODES.INVALID_STAGE_TRANSITION,
            400
          ),
        };
      }

      const allStages = await tx.stage.findMany({
        where: { projectId: currentStage.projectId },
        orderBy: { orderIndex: "asc" },
      });

      let targetStage;

      if (direction === "next") {
        targetStage = allStages.find(
          (s) => s.orderIndex === currentStage.orderIndex + 1
        );
        if (!targetStage) {
          throw {
            __apiError: true,
            response: errorResponse("다음 단계가 없습니다", ERROR_CODES.INVALID_STAGE_TRANSITION, 400),
          };
        }
      } else if (direction === "previous") {
        targetStage = allStages.find(
          (s) => s.orderIndex === currentStage.orderIndex - 1
        );
        if (!targetStage) {
          throw {
            __apiError: true,
            response: errorResponse("이전 단계가 없습니다", ERROR_CODES.INVALID_STAGE_TRANSITION, 400),
          };
        }
      } else {
        // jump
        targetStage = allStages.find((s) => s.id === targetStageId);
        if (!targetStage) {
          throw {
            __apiError: true,
            response: notFoundResponse("대상 단계를 찾을 수 없습니다"),
          };
        }
      }

      // For "next": mark current as completed with summary
      if (direction === "next") {
        await tx.stage.update({
          where: { id: currentStage.id },
          data: {
            status: STAGE_STATUS.COMPLETED,
            summary: summary || null,
          },
        });
      } else {
        // For previous/jump: mark current as waiting
        await tx.stage.update({
          where: { id: currentStage.id },
          data: { status: STAGE_STATUS.WAITING },
        });
      }

      // Set target stage to active
      await tx.stage.update({
        where: { id: targetStage.id },
        data: { status: STAGE_STATUS.ACTIVE },
      });

      // Determine activity type
      const isIdeaAddon =
        direction === "previous" && targetStage.orderIndex === 0;
      const activityType = isIdeaAddon
        ? ACTIVITY_TYPES.IDEA_ADDON
        : ACTIVITY_TYPES.STAGE_TRANSITION;

      // Record activity
      await tx.activity.create({
        data: {
          projectId: currentStage.projectId,
          stageId: targetStage.id,
          activityType,
          description: `"${currentStage.name}" → "${targetStage.name}"`,
        },
      });

      // Update project updatedAt
      await tx.project.update({
        where: { id: currentStage.projectId },
        data: { updatedAt: new Date() },
      });

      // Return updated stages
      return tx.stage.findMany({
        where: { projectId: currentStage.projectId },
        orderBy: { orderIndex: "asc" },
      });
    });

    return successResponse(result);
  } catch (error: unknown) {
    // Handle early-return API errors thrown from within the transaction
    if (
      error &&
      typeof error === "object" &&
      "__apiError" in error &&
      "response" in error
    ) {
      return (error as { response: Response }).response;
    }
    console.error("POST /api/stages/[id]/transition error:", error);
    return handlePrismaError(error);
  }
}
