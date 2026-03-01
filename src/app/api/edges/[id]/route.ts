import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateEdgeSchema } from "@/lib/schemas/edge";

type Params = { params: Promise<{ id: string }> };

// PUT /api/edges/:id — update edge type/label
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateEdgeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.edge.findUnique({ where: { id } });
    if (!existing) return notFound("Edge", id);

    const updated = await prisma.edge.update({
      where: { id },
      data: parsed.data,
    });

    return successResponse(updated);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// DELETE /api/edges/:id — delete edge
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const existing = await prisma.edge.findUnique({ where: { id } });
    if (!existing) return notFound("Edge", id);

    await prisma.edge.delete({ where: { id } });
    return successResponse({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
