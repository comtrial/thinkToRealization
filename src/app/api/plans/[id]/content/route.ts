import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updatePlanContentSchema } from "@/lib/schemas/plan";

type Params = { params: Promise<{ id: string }> };

// PUT /api/plans/:id/content — directly edit plan content
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

    const parsed = updatePlanContentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) return notFound("Plan", id);

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        content: JSON.stringify(parsed.data.content),
        status: "revised",
      },
    });

    return successResponse({
      ...updated,
      content: JSON.parse(updated.content),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}
