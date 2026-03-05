import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, errorResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { assembleContext } from "../../../../../../server/context/context-assembler";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/nodes/:id/context — assemble context for preview/debug
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) return notFound("Node", id);

    const context = await assembleContext(prisma, id);
    return successResponse(context);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Node not found")) {
      return errorResponse("NODE_NOT_FOUND", error.message, 404);
    }
    return handlePrismaError(error);
  }
}
