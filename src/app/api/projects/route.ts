import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import {
  DEFAULT_STAGES,
  STAGE_STATUS,
  PROJECT_STATUS,
  ACTIVITY_TYPES,
} from "@/lib/constants";

// GET /api/projects - List all projects with current stage and progress
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const projectsWithProgress = projects.map((project) => {
      const stages = project.stages;
      const completedCount = stages.filter(
        (s) => s.status === STAGE_STATUS.COMPLETED
      ).length;
      const progress =
        stages.length > 0
          ? Math.round((completedCount / stages.length) * 100)
          : 0;
      const currentStage = stages.find(
        (s) => s.status === STAGE_STATUS.ACTIVE
      );

      return {
        ...project,
        currentStage: currentStage ?? null,
        progress,
      };
    });

    return successResponse(projectsWithProgress);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return handlePrismaError(error);
  }
}

// POST /api/projects - Create project with 6 default stages + initial activity (atomic)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return validationErrorResponse("프로젝트 이름은 필수입니다");
    }

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          status: PROJECT_STATUS.ACTIVE,
        },
      });

      await tx.stage.createMany({
        data: DEFAULT_STAGES.map((stage, index) => ({
          projectId: newProject.id,
          name: stage.name,
          orderIndex: stage.orderIndex,
          status: index === 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.WAITING,
        })),
      });

      await tx.activity.create({
        data: {
          projectId: newProject.id,
          activityType: ACTIVITY_TYPES.PROJECT_CREATED,
          description: `프로젝트 "${newProject.name}" 생성`,
        },
      });

      return tx.project.findUnique({
        where: { id: newProject.id },
        include: {
          stages: { orderBy: { orderIndex: "asc" } },
          activities: true,
        },
      });
    });

    return successResponse(project, 201);
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return handlePrismaError(error);
  }
}
