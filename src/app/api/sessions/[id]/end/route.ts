import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
  errorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { endSessionSchema } from "@/lib/schemas/session";

type Params = { params: Promise<{ id: string }> };

// PUT /api/sessions/:id/end — end session, optionally update node status
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

    const parsed = endSessionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const session = await prisma.session.findUnique({
      where: { id },
      include: { node: true },
    });
    if (!session) return notFound("Session", id);

    if (session.status !== "active" && session.status !== "paused") {
      return errorResponse(
        "SESSION_NOT_ACTIVE",
        "Session is not active or paused",
        400
      );
    }

    const now = new Date();
    const additionalSeconds = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / 1000
    );
    const totalDuration = session.durationSeconds + additionalSeconds;

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.completed) {
        // completed=true: session → completed, node → done
        const updatedSession = await tx.session.update({
          where: { id },
          data: {
            status: "completed",
            endedAt: now,
            durationSeconds: totalDuration,
          },
        });

        const node = session.node;
        if (node.status === "in_progress" || node.status === "todo") {
          await tx.node.update({
            where: { id: node.id },
            data: { status: "done" },
          });
          await tx.nodeStateLog.create({
            data: {
              nodeId: node.id,
              fromStatus: node.status,
              toStatus: "done",
              triggerType: "session_end_done",
              triggerSessionId: id,
            },
          });
        }

        return updatedSession;
      } else {
        // completed=false: session → paused, node → todo
        const updatedSession = await tx.session.update({
          where: { id },
          data: {
            status: "paused",
            endedAt: now,
            durationSeconds: totalDuration,
          },
        });

        const node = session.node;
        if (node.status === "in_progress") {
          await tx.node.update({
            where: { id: node.id },
            data: { status: "todo" },
          });
          await tx.nodeStateLog.create({
            data: {
              nodeId: node.id,
              fromStatus: node.status,
              toStatus: "todo",
              triggerType: "session_end_pause",
              triggerSessionId: id,
            },
          });
        }

        return updatedSession;
      }
    });

    return successResponse(result);
  } catch (error) {
    return handlePrismaError(error);
  }
}
