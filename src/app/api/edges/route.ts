import { NextRequest, NextResponse } from "next/server";
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
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body", status: 400 } },
        { status: 400 }
      );
    }

    const parsed = createEdgeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Prevent self-referencing edge
    if (parsed.data.fromNodeId === parsed.data.toNodeId) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Cannot create edge from a node to itself",
        400
      );
    }

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

    // Cross-project check
    if (fromNode.projectId !== toNode.projectId) {
      return errorResponse(
        "CROSS_PROJECT_EDGE",
        "Cannot create edge between nodes in different projects",
        400
      );
    }

    // Duplicate edge check
    const existingEdge = await prisma.edge.findFirst({
      where: { fromNodeId: parsed.data.fromNodeId, toNodeId: parsed.data.toNodeId },
    });
    if (existingEdge) {
      return errorResponse(
        "DUPLICATE_EDGE",
        "An edge between these nodes already exists",
        409
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
