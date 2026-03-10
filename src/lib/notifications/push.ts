import webPush from "web-push";
import { prisma } from "@/lib/db/client";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@ttr.local";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/**
 * Send web push notification to all subscriptions of a user.
 * Stale subscriptions (410/404) are automatically deleted.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 410 Gone or 404 Not Found = subscription expired
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        throw err;
      }
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`[push] ${failures.length}/${subscriptions.length} push(es) failed for user ${userId}`);
  }
}
