import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateNodeSchema } from "@/lib/schemas/node";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id — detail with sessions, decisions, edges
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const node = await prisma.node.findUnique({
      where: { id },
      include: {
        ...nodeWithCounts,
        sessions: { orderBy: { startedAt: "desc" } },
        decisions: { orderBy: { createdAt: "desc" } },
        outEdges: true,
        inEdges: true,
      },
    });
    if (!node) return notFound("Node", id);

    // nodeWithCounts.sessions (take:1) is overridden by full sessions above
    const enriched = toNodeResponse(node as Parameters<typeof toNodeResponse>[0]);

    return successResponse({
      ...enriched,
      sessions: node.sessions,
      decisions: node.decisions,
      outEdges: node.outEdges,
      inEdges: node.inEdges,
    }, {
      headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=10" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

// PUT /api/nodes/:id — update node
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body", status: 400 } },
        { status: 400 }
      );
    }

    const parsed = updateNodeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) return notFound("Node", id);

    // Convert dueDate string to Date object for Prisma
    const data = { ...parsed.data } as Record<string, unknown>;
    if ('dueDate' in data) {
      data.dueDate = data.dueDate ? new Date(data.dueDate as string) : null;
    }

    const updated = await prisma.node.update({
      where: { id },
      data,
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

    // Clean up attachment files from disk before archiving
    const attachments = await prisma.attachment.findMany({ where: { nodeId: id } });
    await Promise.all(attachments.map((a) => deleteFile(a.storagePath)));

    const archived = await prisma.$transaction(async (tx) => {
      const updated = await tx.node.update({
        where: { id },
        data: { status: "archived" },
      });

      await tx.nodeStateLog.create({
        data: {
          nodeId: id,
          fromStatus: existing.status,
          toStatus: "archived",
          triggerType: "user_manual",
        },
      });

      return updated;
    });

    return successResponse(archived);
  } catch (error) {
    return handlePrismaError(error);
  }
}
