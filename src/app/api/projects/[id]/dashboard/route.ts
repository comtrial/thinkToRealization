import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { nodeCountsOnly, toNodeResponseLite } from "@/lib/node-helpers";
import { requireProjectAccess } from "@/lib/auth/project-guard";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:pid/dashboard?filter=assigned|active|backlog&userId=xxx
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  const filter = req.nextUrl.searchParams.get("filter");
  const userId = req.nextUrl.searchParams.get("userId");

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    // Build base where clause
    const baseWhere: Record<string, unknown> = { projectId };

    // Apply assignee filter
    if (filter === "assigned" && userId) {
      baseWhere.assigneeId = userId;
    }

    // For "active" and "backlog" filters, we still group by status
    // but restrict which statuses are returned
    if (filter === "active") {
      // Only show in_progress nodes
      const inProgress = await prisma.node.findMany({
        where: { ...baseWhere, status: "in_progress" },
        include: nodeCountsOnly,
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

      return successResponse({
        inProgress: inProgress.map(toNodeResponseLite),
        todo: [],
        backlog: [],
        recentDone: [],
      }, {
        headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=15" }
      });
    }

    if (filter === "backlog") {
      // Only show backlog nodes
      const backlog = await prisma.node.findMany({
        where: { ...baseWhere, status: "backlog" },
        include: nodeCountsOnly,
        orderBy: { priority: "desc" },
        take: 50,
      });

      return successResponse({
        inProgress: [],
        todo: [],
        backlog: backlog.map(toNodeResponseLite),
        recentDone: [],
      }, {
        headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=15" }
      });
    }

    // Default: all statuses (with optional assignee filter)
    const [inProgress, todo, backlog, recentDone] = await Promise.all([
      prisma.node.findMany({
        where: { ...baseWhere, status: "in_progress" },
        include: nodeCountsOnly,
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { ...baseWhere, status: "todo" },
        include: nodeCountsOnly,
        orderBy: { priority: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { ...baseWhere, status: "backlog" },
        include: nodeCountsOnly,
        orderBy: { priority: "desc" },
        take: 50,
      }),
      prisma.node.findMany({
        where: { ...baseWhere, status: "done" },
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
