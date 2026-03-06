import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError, notFound, errorResponse } from "@/lib/api-response";

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id } = await params;
    const comment = await prisma.nodeComment.findUnique({ where: { id } });
    if (!comment) return notFound("Comment", id);
    if (comment.userId !== auth.session.userId) {
      return errorResponse("FORBIDDEN", "본인의 댓글만 수정할 수 있습니다", 403);
    }

    const body = await req.json();
    const parsed = updateCommentSchema.parse(body);

    const updated = await prisma.nodeComment.update({
      where: { id },
      data: { content: parsed.content },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id } = await params;
    const comment = await prisma.nodeComment.findUnique({ where: { id } });
    if (!comment) return notFound("Comment", id);
    if (comment.userId !== auth.session.userId) {
      return errorResponse("FORBIDDEN", "본인의 댓글만 삭제할 수 있습니다", 403);
    }

    await prisma.nodeComment.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
