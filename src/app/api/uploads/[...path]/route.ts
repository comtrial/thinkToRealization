import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getFile } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

type Params = { params: Promise<{ path: string[] }> };

// GET /api/uploads/[...path] — serve uploaded files
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const { path } = await params;
    const storagePath = path.join("/");

    const { buffer, exists } = await getFile(storagePath);
    if (!exists) {
      return new NextResponse("File not found", { status: 404 });
    }

    const ext = storagePath.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
