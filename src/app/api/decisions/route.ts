import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound, errorResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createDecisionSchema } from "@/lib/schemas/decision";

// POST /api/decisions — create decision
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

    const parsed = createDecisionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const node = await prisma.node.findUnique({
      where: { id: parsed.data.nodeId },
    });
    if (!node) return notFound("Node", parsed.data.nodeId);

    // Validate sessionId if provided
    if (parsed.data.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: parsed.data.sessionId },
      });
      if (!session) {
        return errorResponse(
          "SESSION_NOT_FOUND",
          `Session with id '${parsed.data.sessionId}' not found`,
          400
        );
      }
      if (session.nodeId !== parsed.data.nodeId) {
        return errorResponse(
          "SESSION_NODE_MISMATCH",
          "Session does not belong to the specified node",
          400
        );
      }
    }

    const decision = await prisma.decision.create({
      data: parsed.data,
    });

    return successResponse(decision, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
