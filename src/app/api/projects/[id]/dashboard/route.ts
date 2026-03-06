import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { nodeCountsOnly, toNodeResponseLite } from "@/lib/node-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:pid/dashboard
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    const [inProgress, todo, backlog, recentDone] = await Promise.all([
      prisma.node.findMany({
        where: { projectId, status: "in_progress" },
        include: nodeCountsOnly,
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { projectId, status: "todo" },
        include: nodeCountsOnly,
        orderBy: { priority: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { projectId, status: "backlog" },
        include: nodeCountsOnly,
        orderBy: { priority: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { projectId, status: "done" },
        include: nodeCountsOnly,
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    return successResponse({
      inProgress: inProgress.map(toNodeResponseLite),
      todo: todo.map(toNodeResponseLite),
      backlog: backlog.map(toNodeResponseLite),
      recentDone: recentDone.map(toNodeResponseLite),
    }, {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=15" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}
