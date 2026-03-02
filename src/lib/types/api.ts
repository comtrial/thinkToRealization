// v2 API response types - aligned with backend-spec.md

export type NodeType = "idea" | "decision" | "task" | "issue" | "milestone" | "note";
export type NodeStatus = "backlog" | "todo" | "in_progress" | "done" | "archived";
export type EdgeType = "sequence" | "dependency" | "related" | "regression" | "branch";
export type SessionStatus = "active" | "paused" | "completed";

export interface NodeResponse {
  id: string;
  projectId: string;
  type: NodeType;
  title: string;
  description: string | null;
  status: NodeStatus;
  priority: string;
  canvasX: number;
  canvasY: number;
  canvasW: number;
  canvasH: number;
  parentNodeId: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  sessionCount: number;
  decisionCount: number;
  fileChangeCount: number;
  hasActiveSession: boolean;
  lastSessionAt: string | null;
  lastSessionTitle: string | null;
}

export interface EdgeResponse {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: EdgeType;
  label: string | null;
  createdAt: string;
}

export interface SessionResponse {
  id: string;
  nodeId: string;
  title: string | null;
  claudeSessionId: string | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  fileChangeCount: number;
  resumeCount: number;
  durationSeconds: number;
  logFilePath: string | null;
}

export interface DecisionResponse {
  id: string;
  nodeId: string;
  sessionId: string | null;
  content: string;
  promotedToNodeId: string | null;
  createdAt: string;
}

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  index: number;
  highlightId: string | null;
}

export interface ProjectResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  canvasViewportX: number;
  canvasViewportY: number;
  canvasViewportZoom: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasResponse {
  nodes: NodeResponse[];
  edges: EdgeResponse[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface DashboardResponse {
  inProgress: NodeResponse[];
  todo: NodeResponse[];
  recentDone: NodeResponse[];
}

export interface SessionLogResponse {
  raw: string;
  messages: SessionMessage[];
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: { timestamp: string };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
  };
}
