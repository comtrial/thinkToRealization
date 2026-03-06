import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updatePlanStatusSchema } from "@/lib/schemas/plan";

type Params = { params: Promise<{ id: string }> };

// GET /api/plans/:id — plan detail
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return notFound("Plan", id);

    return successResponse({
      ...plan,
      content: JSON.parse(plan.content),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

// PUT /api/plans/:id — update plan status (approve/reject)
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

    const parsed = updatePlanStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) return notFound("Plan", id);

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewNote: parsed.data.reviewNote ?? null,
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
