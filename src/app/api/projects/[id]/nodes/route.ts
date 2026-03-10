import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createNodeSchema } from "@/lib/schemas/node";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";
import { requireProjectAccess } from "@/lib/auth/project-guard";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:pid/nodes
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const status = req.nextUrl.searchParams.get("status");

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;

    const nodes = await prisma.node.findMany({
      where,
      include: nodeWithCounts,
      orderBy: { createdAt: "asc" },
    });

    return successResponse(nodes.map(toNodeResponse));
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/projects/:pid/nodes
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  try {
    const body = await req.json();
    const parsed = createNodeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return notFound("Project", projectId);

    const node = await prisma.node.create({
      data: { ...parsed.data, projectId, createdById: access.data.session.userId },
      include: nodeWithCounts,
    });

    return successResponse(toNodeResponse(node), 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
