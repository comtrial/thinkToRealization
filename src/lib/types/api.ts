// v2 API response types - aligned with backend-spec.md

export type NodeType = "planning" | "feature" | "issue";
export type NodeStatus = "backlog" | "todo" | "in_progress" | "done" | "archived";
export type EdgeType = "related" | "parent_child" | "sequence" | "dependency" | "regression" | "branch";
export type SessionStatus = "active" | "paused" | "completed";
export type PlanStatus = "draft" | "approved" | "rejected" | "revised";

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
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  commentCount: number;
  sessionCount: number;
  decisionCount: number;
  fileChangeCount: number;
  childCount: number;
  planCount: number;
  latestPlanStatus: string | null;
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

export interface PlanContent {
  summary: string;
  affectedFiles: Array<{
    path: string;
    action: "create" | "modify" | "delete";
    description: string;
  }>;
  changes: Array<{
    title: string;
    description: string;
    risk: "low" | "medium" | "high";
  }>;
  testPlan: Array<{
    description: string;
    type: "unit" | "integration" | "e2e";
  }>;
  risks: Array<{
    description: string;
    severity: "low" | "medium" | "high";
    mitigation: string;
  }>;
}

export interface PlanResponse {
  id: string;
  nodeId: string;
  version: number;
  status: PlanStatus;
  content: PlanContent;
  prompt: string;
  rawResponse: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
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
  projectDir: string;
  claudeMdPath: string | null;
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
  backlog: NodeResponse[];
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

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface CommentResponse {
  id: string;
  nodeId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  nodeId: string | null;
  actorId: string | null;
  isRead: boolean;
  createdAt: string;
}
