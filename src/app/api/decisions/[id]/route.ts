import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/decisions/[id] - Update content, context
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, context } = body;

    const existing = await prisma.decision.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("결정사항을 찾을 수 없습니다");
    }

    const updated = await prisma.decision.update({
      where: { id },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(context !== undefined && { context: context?.trim() || null }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("PATCH /api/decisions/[id] error:", error);
    return handlePrismaError(error);
  }
}

// DELETE /api/decisions/[id] - Delete decision
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.decision.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("결정사항을 찾을 수 없습니다");
    }

    await prisma.decision.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/decisions/[id] error:", error);
    return handlePrismaError(error);
  }
}
