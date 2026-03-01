import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { STAGE_STATUS } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/stages/[id] - Update stage status, summary
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, summary } = body;

    const existing = await prisma.stage.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("단계를 찾을 수 없습니다");
    }

    if (
      status &&
      !(Object.values(STAGE_STATUS) as string[]).includes(status)
    ) {
      return validationErrorResponse(
        `유효하지 않은 상태입니다: ${status}`
      );
    }

    const updated = await prisma.stage.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(summary !== undefined && { summary }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("PATCH /api/stages/[id] error:", error);
    return handlePrismaError(error);
  }
}
