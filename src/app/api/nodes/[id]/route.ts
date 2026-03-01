import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateNodeSchema } from "@/lib/schemas/node";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id — detail with sessions, decisions, edges
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const node = await prisma.node.findUnique({
      where: { id },
      include: {
        ...nodeWithCounts,
        decisions: { orderBy: { createdAt: "desc" } },
        outEdges: true,
        inEdges: true,
      },
    });
    if (!node) return notFound("Node", id);

    const sessions = await prisma.session.findMany({
      where: { nodeId: id },
      orderBy: { startedAt: "desc" },
    });

    const enriched = toNodeResponse(node);

    return successResponse({
      ...enriched,
      sessions,
      decisions: node.decisions,
      outEdges: node.outEdges,
      inEdges: node.inEdges,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

// PUT /api/nodes/:id — update node
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateNodeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) return notFound("Node", id);

    const updated = await prisma.node.update({
      where: { id },
      data: parsed.data,
      include: nodeWithCounts,
    });

    return successResponse(toNodeResponse(updated));
  } catch (error) {
    return handlePrismaError(error);
  }
}

// DELETE /api/nodes/:id — archive node (set status to archived)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) return notFound("Node", id);

    const archived = await prisma.node.update({
      where: { id },
      data: { status: "archived" },
    });

    // Log state change
    await prisma.nodeStateLog.create({
      data: {
        nodeId: id,
        fromStatus: existing.status,
        toStatus: "archived",
        triggerType: "user_manual",
      },
    });

    return successResponse(archived);
  } catch (error) {
    return handlePrismaError(error);
  }
}
