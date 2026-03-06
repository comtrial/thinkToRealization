import { Prisma } from "@prisma/client";
import type { NodeResponse, NodeType, NodeStatus } from "./types/api";

// Count-only include (dashboard, canvas — no session/plan detail needed)
export const nodeCountsOnly = {
  _count: {
    select: {
      sessions: true,
      decisions: true,
      childNodes: true,
      plans: true,
      comments: true,
    },
  },
  assignee: {
    select: { id: true, name: true, avatarUrl: true },
  },
} as const;

// Full include for detail pages (includes latest session + plan)
export const nodeWithCounts = {
  ...nodeCountsOnly,
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
  plans: {
    select: {
      status: true,
    },
    orderBy: { createdAt: Prisma.SortOrder.desc },
    take: 1,
  },
} as const;

type NodeWithCounts = Prisma.NodeGetPayload<{
  include: typeof nodeWithCounts;
}>;

type NodeWithCountsOnly = Prisma.NodeGetPayload<{
  include: typeof nodeCountsOnly;
}>;

export function toNodeResponseLite(node: NodeWithCountsOnly): NodeResponse {
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
    assigneeId: node.assigneeId ?? null,
    assigneeName: node.assignee?.name ?? null,
    assigneeAvatarUrl: node.assignee?.avatarUrl ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    commentCount: node._count.comments,
    sessionCount: node._count.sessions,
    decisionCount: node._count.decisions,
    fileChangeCount: 0,
    childCount: node._count.childNodes,
    planCount: node._count.plans,
    latestPlanStatus: null,
    hasActiveSession: false,
    lastSessionAt: null,
    lastSessionTitle: null,
  };
}

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
    assigneeId: node.assigneeId ?? null,
    assigneeName: node.assignee?.name ?? null,
    assigneeAvatarUrl: node.assignee?.avatarUrl ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    commentCount: node._count.comments,
    sessionCount: node._count.sessions,
    decisionCount: node._count.decisions,
    fileChangeCount: totalFileChanges,
    childCount: node._count.childNodes,
    planCount: node._count.plans,
    latestPlanStatus: node.plans[0]?.status ?? null,
    hasActiveSession: lastSession?.status === "active",
    lastSessionAt: lastSession?.startedAt?.toISOString() ?? null,
    lastSessionTitle: lastSession?.title ?? null,
  };
}
