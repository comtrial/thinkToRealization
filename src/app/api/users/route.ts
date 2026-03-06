import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    return successResponse(users);
  } catch (error) {
    return handleApiError(error);
  }
}
