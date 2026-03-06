export const NODE_TYPES = [
  "planning", "feature", "issue",
] as const;

export const NODE_STATUSES = [
  "backlog", "todo", "in_progress", "done", "archived",
] as const;

export const PRIORITIES = [
  "none", "low", "medium", "high", "urgent",
] as const;

export const EDGE_TYPES = [
  "related", "parent_child", "sequence", "dependency", "regression", "branch",
] as const;

export const SESSION_STATUSES = [
  "active", "paused", "completed",
] as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NODE_NOT_FOUND: "NODE_NOT_FOUND",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  EDGE_NOT_FOUND: "EDGE_NOT_FOUND",
  DECISION_NOT_FOUND: "DECISION_NOT_FOUND",
  COMMENT_NOT_FOUND: "COMMENT_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_ALREADY_ACTIVE: "SESSION_ALREADY_ACTIVE",
  CONFLICT: "CONFLICT",
  DB_WRITE_FAILED: "DB_WRITE_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export const NOTIFICATION_TYPES = ["comment", "assignment"] as const;

export const WS_PORT = 3001;
export const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:${WS_PORT}`
    : `ws://localhost:${WS_PORT}`;
