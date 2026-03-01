import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  errorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createEdgeSchema } from "@/lib/schemas/edge";

// POST /api/edges — create edge
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createEdgeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Validate both nodes exist
    const [fromNode, toNode] = await Promise.all([
      prisma.node.findUnique({ where: { id: parsed.data.fromNodeId } }),
      prisma.node.findUnique({ where: { id: parsed.data.toNodeId } }),
    ]);

    if (!fromNode || !toNode) {
      return errorResponse(
        "NODE_NOT_FOUND",
        "One or both nodes not found",
        404
      );
    }

    // Prevent self-referencing edge
    if (parsed.data.fromNodeId === parsed.data.toNodeId) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Cannot create edge from a node to itself",
        400
      );
    }

    const edge = await prisma.edge.create({
      data: parsed.data,
    });

    return successResponse(edge, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
