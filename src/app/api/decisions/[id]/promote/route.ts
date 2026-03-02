import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { promoteDecisionSchema } from "@/lib/schemas/decision";

type Params = { params: Promise<{ id: string }> };

// POST /api/decisions/:id/promote — promote decision to new node
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
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
    const parsed = promoteDecisionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const decision = await prisma.decision.findUnique({
      where: { id },
      include: { node: true },
    });
    if (!decision) return notFound("Decision", id);

    const result = await prisma.$transaction(async (tx) => {
      // Create new node from decision
      const newNode = await tx.node.create({
        data: {
          projectId: decision.node.projectId,
          type: parsed.data.nodeType,
          title: parsed.data.title,
          canvasX: decision.node.canvasX + 350,
          canvasY: decision.node.canvasY,
        },
      });

      // Create edge from source node to new node
      const newEdge = await tx.edge.create({
        data: {
          fromNodeId: decision.nodeId,
          toNodeId: newNode.id,
          type: "sequence",
        },
      });

      // Update decision with promoted node reference
      const updatedDecision = await tx.decision.update({
        where: { id },
        data: { promotedToNodeId: newNode.id },
      });

      return { decision: updatedDecision, newNode, newEdge };
    });

    return successResponse(result, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
