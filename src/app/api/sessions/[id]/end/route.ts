import { NextRequest } from "next/server";
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
    const body = await req.json();
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
    const durationSeconds = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / 1000
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.session.update({
        where: { id },
        data: {
          status: "completed",
          endedAt: now,
          durationSeconds,
        },
      });

      // If completed=true, transition node to done
      if (parsed.data.completed) {
        const node = session.node;
        if (node.status === "in_progress") {
          await tx.node.update({
            where: { id: node.id },
            data: { status: "done" },
          });
          await tx.nodeStateLog.create({
            data: {
              nodeId: node.id,
              fromStatus: "in_progress",
              toStatus: "done",
              triggerType: "session_end_done",
              triggerSessionId: id,
            },
          });
        }
      } else {
        // Session ended but task continues
        await tx.nodeStateLog.create({
          data: {
            nodeId: session.nodeId,
            fromStatus: session.node.status,
            toStatus: session.node.status,
            triggerType: "session_end_continue",
            triggerSessionId: id,
          },
        });
      }

      return updatedSession;
    });

    return successResponse(result);
  } catch (error) {
    return handlePrismaError(error);
  }
}
