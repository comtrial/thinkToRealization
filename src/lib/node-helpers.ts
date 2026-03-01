import { Prisma } from "@prisma/client";
import type { NodeResponse, NodeType, NodeStatus } from "./types/api";

// Prisma include for computing NodeResponse fields
export const nodeWithCounts = {
  _count: {
    select: {
      sessions: true,
      decisions: true,
    },
  },
  sessions: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      title: true,
      fileChangeCount: true,
    },
    orderBy: { startedAt: Prisma.SortOrder.desc },
    take: 1,
  },
} as const;

type NodeWithCounts = Prisma.NodeGetPayload<{
  include: typeof nodeWithCounts;
}>;

export function toNodeResponse(node: NodeWithCounts): NodeResponse {
  const lastSession = node.sessions[0] ?? null;
  const totalFileChanges = node.sessions.reduce(
    (sum, s) => sum + s.fileChangeCount,
    0
  );

  return {
    id: node.id,
    projectId: node.projectId,
    type: node.type as NodeType,
    title: node.title,
    description: node.description,
    status: node.status as NodeStatus,
    priority: node.priority,
    canvasX: node.canvasX,
    canvasY: node.canvasY,
    canvasW: node.canvasW,
    canvasH: node.canvasH,
    parentNodeId: node.parentNodeId,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    sessionCount: node._count.sessions,
    decisionCount: node._count.decisions,
    fileChangeCount: totalFileChanges,
    hasActiveSession: lastSession?.status === "active",
    lastSessionAt: lastSession?.startedAt?.toISOString() ?? null,
    lastSessionTitle: lastSession?.title ?? null,
  };
}
