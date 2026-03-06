import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateProjectSchema } from "@/lib/schemas/project";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: { select: { nodes: true } },
      },
    });
    if (!project) return notFound("Project", id);
    return successResponse(project, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

// PUT /api/projects/:id
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
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
    });
    return successResponse(project);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// DELETE /api/projects/:id (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
    return successResponse({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
