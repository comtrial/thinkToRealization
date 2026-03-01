import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createDecisionSchema } from "@/lib/schemas/decision";

// POST /api/decisions — create decision
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createDecisionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const node = await prisma.node.findUnique({
      where: { id: parsed.data.nodeId },
    });
    if (!node) return notFound("Node", parsed.data.nodeId);

    const decision = await prisma.decision.create({
      data: parsed.data,
    });

    return successResponse(decision, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
