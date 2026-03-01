export const DEFAULT_STAGES = [
  { name: "아이디어 발산", orderIndex: 0 },
  { name: "문제 정의", orderIndex: 1 },
  { name: "기능 구조화", orderIndex: 2 },
  { name: "기술 설계", orderIndex: 3 },
  { name: "구현", orderIndex: 4 },
  { name: "검증/회고", orderIndex: 5 },
] as const;

export const STAGE_STATUS = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export const PROJECT_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  COMPLETED: "completed",
} as const;

export const ACTIVITY_TYPES = {
  PROJECT_CREATED: "project_created",
  STAGE_TRANSITION: "stage_transition",
  SESSION_CREATED: "session_created",
  DECISION_CREATED: "decision_created",
  IDEA_ADDON: "idea_addon",
} as const;

export const ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INVALID_STAGE_TRANSITION: "INVALID_STAGE_TRANSITION",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export const WS_PORT = 3001;
export const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:${WS_PORT}`
    : `ws://localhost:${WS_PORT}`;
