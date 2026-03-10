import { prisma } from "@/lib/db/client";
import { sendPushToUser } from "./push";

type NotificationType = "comment" | "assignment" | "status_change";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  nodeId?: string;
  actorId?: string;
  /** Set true to allow self-notifications (e.g., self-assignment) */
  allowSelf?: boolean;
}) {
  // Block self-notifications unless explicitly allowed
  if (!params.allowSelf && params.actorId && params.actorId === params.userId) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      nodeId: params.nodeId ?? null,
      actorId: params.actorId ?? null,
    },
  });

  // Push: never send to self (regardless of allowSelf for in-app)
  const shouldPush = !(params.actorId && params.actorId === params.userId);
  if (shouldPush) {
    sendPushToUser(params.userId, {
      title: params.title,
      body: params.body,
      tag: params.type,
      url: params.nodeId ? `/?node=${params.nodeId}` : "/",
    }).catch(console.warn);
  }

  return notification;
}
