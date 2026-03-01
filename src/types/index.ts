export type StageStatus = "waiting" | "active" | "completed";
export type ProjectStatus = "active" | "archived" | "completed";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  stages?: Stage[];
  activities?: Activity[];
};

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

export type Session = {
  id: string;
  stageId: string;
  title: string | null;
  autoSummary: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: TerminalLog[];
  decisions?: Decision[];
};

export type TerminalLog = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  rawLength: number | null;
  createdAt: string;
};

export type Decision = {
  id: string;
  stageId: string;
  sessionId: string | null;
  content: string;
  context: string | null;
  createdAt: string;
};

export type Activity = {
  id: string;
  projectId: string;
  stageId: string | null;
  activityType: string;
  description: string | null;
  createdAt: string;
};

export type ProjectWithProgress = Project & {
  currentStage?: Stage;
  progress: number;
  lastDecision?: Decision;
};
