import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";

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
        include: nodeWithCounts,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.node.findMany({
        where: { projectId, status: "todo" },
        include: nodeWithCounts,
        orderBy: { priority: "desc" },
      }),
      prisma.node.findMany({
        where: { projectId, status: "backlog" },
        include: nodeWithCounts,
        orderBy: { priority: "desc" },
      }),
      prisma.node.findMany({
        where: { projectId, status: "done" },
        include: nodeWithCounts,
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    return successResponse({
      inProgress: inProgress.map(toNodeResponse),
      todo: todo.map(toNodeResponse),
      backlog: backlog.map(toNodeResponse),
      recentDone: recentDone.map(toNodeResponse),
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}
