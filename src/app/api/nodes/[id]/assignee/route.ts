import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError, notFound } from "@/lib/api-response";
import { createNotification } from "@/lib/notifications/create";

const setAssigneeSchema = z.object({
  assigneeId: z.string().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id: nodeId } = await params;
    const body = await req.json();
    const parsed = setAssigneeSchema.parse(body);

    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, title: true, assigneeId: true },
    });
    if (!node) return notFound("Node", nodeId);

    // Validate assignee exists (if provided)
    if (parsed.assigneeId) {
      const user = await prisma.user.findUnique({ where: { id: parsed.assigneeId } });
      if (!user) return notFound("User", parsed.assigneeId);
    }

    const updated = await prisma.node.update({
      where: { id: nodeId },
      data: { assigneeId: parsed.assigneeId },
      select: {
        id: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Notify new assignee (including self-assignment)
    if (parsed.assigneeId) {
      const isSelf = parsed.assigneeId === auth.session.userId;
      await createNotification({
        userId: parsed.assigneeId,
        type: "assignment",
        title: "노드 배정",
        body: isSelf
          ? `'${node.title}' 노드가 나에게 배정되었습니다`
          : `${auth.session.name}님이 '${node.title}' 노드를 배정했습니다`,
        nodeId: node.id,
        actorId: auth.session.userId,
        allowSelf: true,
      });
    }

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
