import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";
import { requireProjectAccess } from "@/lib/auth/project-guard";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:pid/canvas
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    const [nodes, edges] = await Promise.all([
      prisma.node.findMany({
        where: { projectId, status: { not: "archived" } },
        include: nodeWithCounts,
        orderBy: { createdAt: "asc" },
      }),
      prisma.edge.findMany({
        where: { fromNode: { projectId } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return successResponse({
      nodes: nodes.map(toNodeResponse),
      edges,
      viewport: {
        x: project.canvasViewportX,
        y: project.canvasViewportY,
        zoom: project.canvasViewportZoom,
      },
    }, {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=15" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}
