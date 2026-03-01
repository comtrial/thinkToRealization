// Re-export all API types for convenience
export type {
  NodeResponse,
  EdgeResponse,
  SessionResponse,
  SessionMessage,
  SessionLogResponse,
  CanvasResponse,
  DashboardResponse,
  DecisionResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
} from "@/lib/types/api";

// Node types & statuses
export type NodeType = "idea" | "decision" | "task" | "issue" | "milestone" | "note";
export type NodeStatus = "backlog" | "todo" | "in_progress" | "done" | "archived";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type EdgeType = "sequence" | "dependency" | "related" | "regression" | "branch";
export type SessionStatus = "active" | "paused" | "completed";

export type Project = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  projectDir: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  canvasViewportX: number;
  canvasViewportY: number;
  canvasViewportZoom: number;
};

export type Session = {
  id: string;
  nodeId: string;
  title: string | null;
  claudeSessionId: string | null;
  status: string;
  fileChangeCount: number;
  resumeCount: number;
  logFilePath: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  decisions?: Decision[];
  files?: SessionFile[];
};

export type Decision = {
  id: string;
  nodeId: string;
  sessionId: string | null;
  content: string;
  promotedToNodeId: string | null;
  createdAt: string;
};

export type SessionFile = {
  id: string;
  sessionId: string;
  filePath: string;
  changeType: string;
  detectedAt: string;
};

// ─── Legacy v1 types (referenced by v1 frontend, will be removed in F-phase) ───

/** @deprecated Use NodeStatus instead */
export type StageStatus = "waiting" | "active" | "completed";
/** @deprecated Use Project.isActive instead */
export type ProjectStatus = "active" | "archived" | "completed";

/** @deprecated Stage model removed in v2, use Node */
export type Stage = {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
  status: StageStatus;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  sessions?: Session[];
  decisions?: Decision[];
};

/** @deprecated TerminalLog removed in v2, logs stored as files */
export type TerminalLog = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  rawLength: number | null;
  createdAt: string;
};

/** @deprecated Activity model removed in v2, use NodeStateLog */
export type Activity = {
  id: string;
  projectId: string;
  stageId: string | null;
  activityType: string;
  description: string | null;
  createdAt: string;
};

/** @deprecated Will be replaced with v2 dashboard types */
export type ProjectWithProgress = Project & {
  currentStage?: Stage;
  progress: number;
  lastDecision?: Decision;
};
