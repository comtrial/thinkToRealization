import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import {
  successResponse,
  errorResponse,
  handleApiError,
  notFound,
} from "@/lib/api-response";
import { saveFile } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id/attachments — list attachments for a node
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id: nodeId } = await params;

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return notFound("Node", nodeId);

    const attachments = await prisma.attachment.findMany({
      where: { nodeId },
      orderBy: { createdAt: "desc" },
    });

    const result = attachments.map((a) => ({
      ...a,
      url: `/api/uploads/${a.storagePath}`,
    }));

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/nodes/:id/attachments — upload attachment
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { id: nodeId } = await params;

    // Verify node exists
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return notFound("Node", nodeId);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return errorResponse("NO_FILE", "No file provided", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "FILE_TOO_LARGE",
        "File too large (max 10MB)",
        400
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(
        "INVALID_FILE_TYPE",
        `File type not allowed: ${file.type}`,
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Create DB record first to get the ID
    const attachment = await prisma.attachment.create({
      data: {
        nodeId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath: "", // temporary
        uploadedById: auth.session.userId,
      },
    });

    // Save file and update storage path
    const storagePath = await saveFile(
      nodeId,
      attachment.id,
      file.name,
      buffer
    );

    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { storagePath },
    });

    return successResponse(
      {
        id: updated.id,
        url: `/api/uploads/${storagePath}`,
        fileName: updated.fileName,
        fileType: updated.fileType,
        fileSize: updated.fileSize,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
