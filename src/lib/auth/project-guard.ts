import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { requireAuth } from "./guard";

export type ProjectRole = "owner" | "admin" | "member";

export interface ProjectAccessResult {
  session: { userId: string; email: string; name: string };
  membership: { id: string; role: ProjectRole; projectId: string; userId: string };
}

/**
 * Checks that the user is authenticated AND is a member of the given project.
 * Returns the session + membership record, or a 401/403 error response.
 *
 * @param requiredRole - if set, user must have this role or higher
 *   Role hierarchy: owner > admin > member
 */
export async function requireProjectAccess(
  req: NextRequest,
  projectId: string,
  requiredRole?: ProjectRole
): Promise<{ data: ProjectAccessResult; response?: never } | { data?: never; response: NextResponse }> {
  const auth = await requireAuth(req);
  if (auth.response) return { response: auth.response };

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: auth.session.userId,
      },
    },
  });

  if (!membership) {
    return {
      response: errorResponse("FORBIDDEN", "이 프로젝트에 대한 접근 권한이 없습니다", 403),
    };
  }

  // Check role hierarchy if a required role is specified
  if (requiredRole) {
    const hierarchy: Record<ProjectRole, number> = { member: 0, admin: 1, owner: 2 };
    const userLevel = hierarchy[membership.role as ProjectRole] ?? 0;
    const requiredLevel = hierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return {
        response: errorResponse("FORBIDDEN", "이 작업에 대한 권한이 없습니다", 403),
      };
    }
  }

  return {
    data: {
      session: auth.session,
      membership: {
        id: membership.id,
        role: membership.role as ProjectRole,
        projectId: membership.projectId,
        userId: membership.userId,
      },
    },
  };
}
