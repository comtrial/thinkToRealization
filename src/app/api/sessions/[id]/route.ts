import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/sessions/[id] - Get session with terminal_logs
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        logs: { orderBy: { createdAt: "asc" } },
        decisions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!session) {
      return notFoundResponse("세션을 찾을 수 없습니다");
    }

    return successResponse(session);
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
    return handlePrismaError(error);
  }
}

// PATCH /api/sessions/[id] - Update session
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, autoSummary } = body;

    const existing = await prisma.session.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("세션을 찾을 수 없습니다");
    }

    const updated = await prisma.session.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(autoSummary !== undefined && { autoSummary }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return handlePrismaError(error);
  }
}

// DELETE /api/sessions/[id] - Delete session
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.session.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("세션을 찾을 수 없습니다");
    }

    await prisma.session.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return handlePrismaError(error);
  }
}
