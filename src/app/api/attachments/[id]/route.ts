import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import {
  successResponse,
  handleApiError,
  notFound,
} from "@/lib/api-response";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/attachments/:id — delete an attachment
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) return notFound("Attachment", id);

    // Delete file from disk
    await deleteFile(attachment.storagePath);

    // Delete DB record
    await prisma.attachment.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
