import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { createProjectSchema } from "@/lib/schemas/project";
import { requireAuth } from "@/lib/auth/guard";

// GET /api/projects — list projects where user is a member
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  try {
    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
        members: { some: { userId: auth.session.userId } },
      },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = projects.map((p) => {
      const { _count, ...rest } = p;
      return { ...rest, memberCount: _count.members };
    });

    return successResponse(result, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/projects — create project
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

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
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Auto-generate slug from title if not provided
    let slug = parsed.data.slug;
    if (!slug) {
      const baseSlug = parsed.data.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || `project-${Date.now()}`;

      // Check for collision, append timestamp if needed
      const existing = await prisma.project.findUnique({ where: { slug: baseSlug } });
      slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;
    }

    // Create project + owner membership in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          title: parsed.data.title,
          slug,
          description: parsed.data.description,
          projectDir: parsed.data.projectDir,
          claudeMdPath: parsed.data.claudeMdPath,
          createdById: auth.session.userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          userId: auth.session.userId,
          role: "owner",
        },
      });

      return proj;
    });

    return successResponse(project, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
