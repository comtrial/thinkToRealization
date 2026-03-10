import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, validationError, handleApiError } from "@/lib/api-response";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: auth.session.userId,
        endpoint: parsed.data.endpoint,
      },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
