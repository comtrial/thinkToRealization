import { prisma } from "@/lib/db/client";

type NotificationType = "comment" | "assignment";

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

  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      nodeId: params.nodeId ?? null,
      actorId: params.actorId ?? null,
    },
  });
}
