import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createProjectSchema } from "@/lib/schemas/project";

// GET /api/projects — list active projects
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    return successResponse(projects);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/projects — create project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const project = await prisma.project.create({ data: parsed.data });
    return successResponse(project, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
