import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, validationError } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { requireProjectAccess } from "@/lib/auth/project-guard";

type Params = { params: Promise<{ id: string; memberId: string }> };

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// PUT /api/projects/:id/members/:memberId — change member role
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: projectId, memberId } = await params;

  // Only owner can change roles
  const access = await requireProjectAccess(req, projectId, "owner");
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

    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Find the target member
    const target = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.projectId !== projectId) {
      return errorResponse("NOT_FOUND", "멤버를 찾을 수 없습니다", 404);
    }

    // Cannot change own role
    if (target.userId === access.data.session.userId) {
      return errorResponse("FORBIDDEN", "자신의 역할은 변경할 수 없습니다", 403);
    }

    // Cannot change another owner's role
    if (target.role === "owner") {
      return errorResponse("FORBIDDEN", "소유자의 역할은 변경할 수 없습니다", 403);
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: parsed.data.role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// DELETE /api/projects/:id/members/:memberId — remove member
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: projectId, memberId } = await params;

  const access = await requireProjectAccess(req, projectId);
  if (access.response) return access.response;

  try {
    // Find the target member
    const target = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.projectId !== projectId) {
      return errorResponse("NOT_FOUND", "멤버를 찾을 수 없습니다", 404);
    }

    const currentRole = access.data.membership.role;
    const isSelf = target.userId === access.data.session.userId;

    // Permission check:
    // - Owner can remove anyone (except: cannot remove last owner)
    // - Admin can remove members (not other admins or owners)
    // - Member can only remove self
    if (!isSelf) {
      if (currentRole === "member") {
        return errorResponse("FORBIDDEN", "다른 멤버를 제거할 권한이 없습니다", 403);
      }
      if (currentRole === "admin" && target.role !== "member") {
        return errorResponse("FORBIDDEN", "관리자 이상의 멤버를 제거할 권한이 없습니다", 403);
      }
    }

    // Cannot remove the last owner
    if (target.role === "owner") {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: "owner" },
      });
      if (ownerCount <= 1) {
        return errorResponse("FORBIDDEN", "마지막 소유자는 제거할 수 없습니다", 403);
      }
    }

    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
