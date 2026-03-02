import { create } from 'zustand'
import type { SessionMessage } from '@/lib/types/api'

interface SessionStore {
  activeSession: {
    sessionId: string
    nodeId: string
    claudeSessionId: string | null
  } | null
  sessionLog: SessionMessage[] | null
  isSessionStarting: boolean
  sessionEndPromptVisible: boolean
  startSession: (nodeId: string, title?: string) => Promise<void>
  endSession: (completed: boolean) => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  dismissEndPrompt: () => void
  loadSessionLog: (sessionId: string) => Promise<void>
  handleSessionStarted: (payload: { sessionId: string; nodeId: string; claudeSessionId?: string }) => void
  handleSessionEnded: (payload: { sessionId: string; needsPrompt?: boolean }) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null,
  sessionLog: null,
  isSessionStarting: false,
  sessionEndPromptVisible: false,
  startSession: async (nodeId, title) => {
    set({ isSessionStarting: true })
    try {
      const res = await fetch(`/api/nodes/${nodeId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        const { data } = await res.json()
        set({
          activeSession: { sessionId: data.id, nodeId, claudeSessionId: data.claudeSessionId },
          isSessionStarting: false,
        })
      }
    } catch (err) {
      console.error('Failed to start session:', err)
      set({ isSessionStarting: false })
    }
  },
  endSession: async (completed) => {
    const { activeSession } = get()
    if (!activeSession) return
    try {
      await fetch(`/api/sessions/${activeSession.sessionId}/end`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      set({ activeSession: null, sessionEndPromptVisible: false })
    } catch (err) {
      console.error('Failed to end session:', err)
    }
  },
  resumeSession: async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/resume`, { method: 'POST' })
      if (res.ok) {
        const { data } = await res.json()
        set({
          activeSession: { sessionId: data.id, nodeId: data.nodeId, claudeSessionId: data.claudeSessionId },
        })
      }
    } catch (err) {
      console.error('Failed to resume session:', err)
    }
  },
  dismissEndPrompt: () => set({ sessionEndPromptVisible: false }),
  loadSessionLog: async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/log`)
      if (res.ok) {
        const { data } = await res.json()
        set({ sessionLog: data.messages })
      }
    } catch (err) {
      console.error('Failed to load session log:', err)
    }
  },
  handleSessionStarted: (payload) => {
    set({
      activeSession: {
        sessionId: payload.sessionId,
        nodeId: payload.nodeId,
        claudeSessionId: payload.claudeSessionId || null,
      },
    })
  },
  handleSessionEnded: (payload) => {
    set({
      activeSession: null,
      sessionEndPromptVisible: payload.needsPrompt === true,
    })
  },
}))
