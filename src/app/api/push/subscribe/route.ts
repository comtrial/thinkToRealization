import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, validationError, handleApiError } from "@/lib/api-response";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { endpoint, keys } = parsed.data;

    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: auth.session.userId,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId: auth.session.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return successResponse({ id: subscription.id });
  } catch (error) {
    return handleApiError(error);
  }
}
