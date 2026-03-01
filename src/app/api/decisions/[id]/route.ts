import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/decisions/:id — remove decision
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const existing = await prisma.decision.findUnique({ where: { id } });
    if (!existing) return notFound("Decision", id);

    await prisma.decision.delete({ where: { id } });
    return successResponse({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
