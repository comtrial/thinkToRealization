import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id/decisions — list decisions for a node
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: nodeId } = await params;
  try {
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return notFound("Node", nodeId);

    const decisions = await prisma.decision.findMany({
      where: { nodeId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(decisions);
  } catch (error) {
    return handlePrismaError(error);
  }
}
