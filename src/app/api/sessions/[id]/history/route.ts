import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/sessions/[id]/history - Paginated terminal logs
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const skip = (page - 1) * limit;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return notFoundResponse("세션을 찾을 수 없습니다");
    }

    const [logs, total] = await Promise.all([
      prisma.terminalLog.findMany({
        where: { sessionId: id },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.terminalLog.count({ where: { sessionId: id } }),
    ]);

    return successResponse({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/sessions/[id]/history error:", error);
    return handlePrismaError(error);
  }
}
