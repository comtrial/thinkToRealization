import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateNodeStatusSchema } from "@/lib/schemas/node";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";

type Params = { params: Promise<{ id: string }> };

// PUT /api/nodes/:id/status — change status with state log
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateNodeStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) return notFound("Node", id);

    const [updated] = await prisma.$transaction([
      prisma.node.update({
        where: { id },
        data: { status: parsed.data.status },
        include: nodeWithCounts,
      }),
      prisma.nodeStateLog.create({
        data: {
          nodeId: id,
          fromStatus: existing.status,
          toStatus: parsed.data.status,
          triggerType: parsed.data.triggerType,
        },
      }),
    ]);

    return successResponse(toNodeResponse(updated));
  } catch (error) {
    return handlePrismaError(error);
  }
}
