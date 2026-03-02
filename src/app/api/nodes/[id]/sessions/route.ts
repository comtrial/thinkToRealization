import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
  errorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createSessionSchema } from "@/lib/schemas/session";

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id/sessions — list sessions for a node
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: nodeId } = await params;
  try {
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return notFound("Node", nodeId);

    const sessions = await prisma.session.findMany({
      where: { nodeId },
      orderBy: { startedAt: "desc" },
      include: {
        _count: { select: { files: true, decisions: true } },
      },
    });

    return successResponse(sessions);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/nodes/:id/sessions — create new session
export async function POST(req: NextRequest, { params }: Params) {
  const { id: nodeId } = await params;
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
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return notFound("Node", nodeId);

    // Check for existing active session
    const activeSession = await prisma.session.findFirst({
      where: { nodeId, status: "active" },
    });
    if (activeSession) {
      return errorResponse(
        "SESSION_ALREADY_ACTIVE",
        `Node already has an active session: ${activeSession.id}`,
        409
      );
    }

    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({
        data: {
          nodeId,
          title: parsed.data.title ?? null,
        },
      });

      // Auto-transition node to in_progress if it's in backlog or todo
      if (node.status === "backlog" || node.status === "todo") {
        await tx.node.update({
          where: { id: nodeId },
          data: { status: "in_progress" },
        });
        await tx.nodeStateLog.create({
          data: {
            nodeId,
            fromStatus: node.status,
            toStatus: "in_progress",
            triggerType: "session_start",
            triggerSessionId: newSession.id,
          },
        });
      }

      return newSession;
    });

    return successResponse(session, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
