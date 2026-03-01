import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { bulkUpdatePositionsSchema } from "@/lib/schemas/node";

// PUT /api/nodes/positions — bulk update node positions
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bulkUpdatePositionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updates = parsed.data.nodes.map((n) =>
      prisma.node.update({
        where: { id: n.id },
        data: { canvasX: n.canvasX, canvasY: n.canvasY },
      })
    );

    await prisma.$transaction(updates);

    return successResponse({ updated: parsed.data.nodes.length });
  } catch (error) {
    return handlePrismaError(error);
  }
}
