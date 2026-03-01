import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:pid/edges
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    const edges = await prisma.edge.findMany({
      where: {
        fromNode: { projectId },
      },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(edges);
  } catch (error) {
    return handlePrismaError(error);
  }
}
