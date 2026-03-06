// ── Client → Server messages ──

export interface WS_PtyInput {
  type: 'pty:input'
  payload: { nodeId: string; data: string }
}

export interface WS_PtyResize {
  type: 'pty:resize'
  payload: { nodeId: string; cols: number; rows: number }
}

export interface WS_SessionStart {
  type: 'session:start'
  payload: {
    nodeId: string
    cols?: number
    rows?: number
    title?: string
    cwd?: string
    /** If provided, WS server skips DB write (REST already created the record) */
    sessionId?: string
  }
}

export interface WS_SessionEnd {
  type: 'session:end'
  payload: { nodeId: string; markDone?: boolean }
}

export interface WS_SessionResume {
  type: 'session:resume'
  payload: {
    nodeId: string
    sessionId: string
    cols?: number
    rows?: number
    cwd?: string
  }
}

export interface WS_Ping {
  type: 'ping'
}

export type WSClientMessage =
  | WS_PtyInput
  | WS_PtyResize
  | WS_SessionStart
  | WS_SessionEnd
  | WS_SessionResume
  | WS_Ping

// ── Server → Client messages ──

export interface WS_PtyData {
  type: 'pty:data'
  payload: { nodeId: string; data: string }
  timestamp: string
}

export interface WS_SessionStarted {
  type: 'session:started'
  payload: {
    nodeId: string
    sessionId: string
    title?: string | null
    status?: string
    fileChangeCount?: number
    startedAt?: string
    hasPty?: boolean
  }
  timestamp: string
}

export interface WS_SessionEnded {
  type: 'session:ended'
  payload: {
    nodeId: string
    sessionId: string
    status?: string
    needsPrompt?: boolean
    exitCode?: number
  }
  timestamp: string
}

export interface WS_SessionResumed {
  type: 'session:resumed'
  payload: { nodeId: string; sessionId: string }
  timestamp: string
}

export interface WS_NodeStateChanged {
  type: 'node:stateChanged'
  payload: {
    nodeId: string
    fromStatus: string
    toStatus: string
    triggerType: string
  }
  timestamp: string
}

export interface WS_NodeFileCountUpdated {
  type: 'node:fileCountUpdated'
  payload: {
    nodeId: string
    sessionId: string
    filePath: string
    changeType: string
    count: number
  }
  timestamp: string
}

export interface WS_PlanGenerating {
  type: 'plan:generating'
  payload: { nodeId: string; planId: string }
  timestamp: string
}

export interface WS_PlanCreated {
  type: 'plan:created'
  payload: { nodeId: string; planId: string; version: number }
  timestamp: string
}

export interface WS_PlanError {
  type: 'plan:error'
  payload: { nodeId: string; error: string }
  timestamp: string
}

export interface WS_Heartbeat {
  type: 'heartbeat'
  timestamp: string
}

export interface WS_Pong {
  type: 'pong'
  timestamp: string
}

export interface WS_Error {
  type: 'error'
  payload: { code: string; message: string }
  timestamp: string
}

export type WSServerMessage =
  | WS_PtyData
  | WS_SessionStarted
  | WS_SessionEnded
  | WS_SessionResumed
  | WS_NodeStateChanged
  | WS_NodeFileCountUpdated
  | WS_PlanGenerating
  | WS_PlanCreated
  | WS_PlanError
  | WS_Heartbeat
  | WS_Pong
  | WS_Error
