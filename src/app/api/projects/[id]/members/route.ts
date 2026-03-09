import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, validationError, errorResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { requireProjectAccess } from "@/lib/auth/project-guard";

type Params = { params: Promise<{ id: string }> };

const inviteMemberSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  role: z.enum(["admin", "member"]).default("member"),
});

// GET /api/projects/:id/members — list project members
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(members);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/projects/:id/members — invite a user by email
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;

  // Only owner or admin can invite
  const access = await requireProjectAccess(req, projectId, "admin");
  if (access.response) return access.response;

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

    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user) {
      return errorResponse("USER_NOT_FOUND", "해당 이메일의 사용자를 찾을 수 없습니다", 404);
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (existing) {
      return errorResponse("CONFLICT", "이미 프로젝트 멤버입니다", 409);
    }

    // Admins cannot invite other admins — only owners can
    if (parsed.data.role === "admin" && access.data.membership.role !== "owner") {
      return errorResponse("FORBIDDEN", "관리자 역할은 소유자만 부여할 수 있습니다", 403);
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        role: parsed.data.role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    return successResponse(member, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
