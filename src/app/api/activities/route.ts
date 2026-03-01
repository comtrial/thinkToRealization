import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

export const dynamic = "force-dynamic";

// GET /api/activities?projectId=xxx - List activities for timeline
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return validationErrorResponse("projectId 쿼리 파라미터는 필수입니다");
    }

    const activities = await prisma.activity.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(activities);
  } catch (error) {
    console.error("GET /api/activities error:", error);
    return handlePrismaError(error);
  }
}
