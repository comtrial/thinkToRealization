export interface TTRNode {
  id: string
  projectId: string
  type: string
  title: string
  description: string | null
  status: string
  priority: string
  parentNodeId: string | null
  assigneeId: string | null
  assigneeName: string | null
  childCount: number
  commentCount: number
  sessionCount: number
  decisionCount: number
  createdAt: string
  updatedAt: string
}

export interface TTRProject {
  id: string
  title: string
  slug: string
  description: string | null
  projectDir: string
  memberCount?: number
}

export interface TTRComment {
  id: string
  nodeId: string
  content: string
  createdAt: string
  user: { id: string; name: string }
}

export interface TTRDecision {
  id: string
  nodeId: string
  content: string
  createdAt: string
}

export interface TTRDashboard {
  inProgress: TTRNode[]
  todo: TTRNode[]
  backlog: TTRNode[]
  recentDone: TTRNode[]
}

export interface TTRApiResponse<T> {
  data: T
  meta: { timestamp: string }
}

export interface TTRApiError {
  error: { code: string; message: string; status: number }
}
