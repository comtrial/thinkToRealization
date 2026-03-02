import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.1).max(4),
});

type Params = { params: Promise<{ id: string }> };

// PUT /api/projects/:pid/canvas/viewport
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
    const parsed = viewportSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return notFound("Project", id);

    await prisma.project.update({
      where: { id },
      data: {
        canvasViewportX: parsed.data.x,
        canvasViewportY: parsed.data.y,
        canvasViewportZoom: parsed.data.zoom,
      },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
