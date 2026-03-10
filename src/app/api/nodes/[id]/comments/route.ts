import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError, notFound } from "@/lib/api-response";
import { createNotification } from "@/lib/notifications/create";

const createCommentSchema = z.object({
  content: z.string().min(1, "댓글 내용을 입력해주세요").max(5000),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id: nodeId } = await params;
    const comments = await prisma.nodeComment.findMany({
      where: { nodeId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(comments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id: nodeId } = await params;
    const body = await req.json();
    const parsed = createCommentSchema.parse(body);

    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, title: true, assigneeId: true, createdById: true },
    });
    if (!node) return notFound("Node", nodeId);

    const comment = await prisma.nodeComment.create({
      data: {
        nodeId,
        userId: auth.session.userId,
        content: parsed.content,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Collect unique users to notify (excluding comment author)
    const notifyUserIds = new Set<string>();
    if (node.assigneeId && node.assigneeId !== auth.session.userId) {
      notifyUserIds.add(node.assigneeId);
    }
    if (node.createdById && node.createdById !== auth.session.userId) {
      notifyUserIds.add(node.createdById);
    }

    // Notify assignee and/or creator
    const notificationPromises = Array.from(notifyUserIds).map((userId) =>
      createNotification({
        userId,
        type: "comment",
        title: "새 댓글",
        body: `${auth.session.name}님이 '${node.title}' 노드에 댓글을 남겼습니다`,
        nodeId: node.id,
        actorId: auth.session.userId,
      })
    );
    await Promise.all(notificationPromises);

    return successResponse(comment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
