import { create } from 'zustand'
import type { NodeResponse, SessionResponse, DecisionResponse } from '@/lib/types/api'

interface NodeStore {
  selectedNode: NodeResponse | null
  sessions: SessionResponse[]
  decisions: DecisionResponse[]
  selectNode: (nodeId: string) => Promise<void>
  clearSelection: () => void
  updateNodeStatus: (nodeId: string, status: string) => Promise<void>
  addDecision: (nodeId: string, content: string, sessionId?: string) => Promise<void>
  removeDecision: (decisionId: string) => Promise<void>
  promoteDecision: (decisionId: string, nodeType: string, title: string) => Promise<void>
}

export const useNodeStore = create<NodeStore>((set) => ({
  selectedNode: null,
  sessions: [],
  decisions: [],
  selectNode: async (nodeId) => {
    try {
      const [nodeRes, sessionsRes, decisionsRes] = await Promise.all([
        fetch(`/api/nodes/${nodeId}`),
        fetch(`/api/nodes/${nodeId}/sessions`),
        fetch(`/api/nodes/${nodeId}/decisions`),
      ])
      const node = nodeRes.ok ? (await nodeRes.json()).data : null
      const sessions = sessionsRes.ok ? (await sessionsRes.json()).data : []
      const decisions = decisionsRes.ok ? (await decisionsRes.json()).data : []
      set({ selectedNode: node, sessions, decisions })
    } catch (err) {
      console.error('Failed to select node:', err)
    }
  },
  clearSelection: () => set({ selectedNode: null, sessions: [], decisions: [] }),
  updateNodeStatus: async (nodeId, status) => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, triggerType: 'user_manual' }),
      })
      if (res.ok) {
        const { data } = await res.json()
        set((s) => ({ selectedNode: s.selectedNode ? { ...s.selectedNode, status: data.status } : null }))
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  },
  addDecision: async (nodeId, content, sessionId) => {
    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, sessionId, content }),
      })
      if (res.ok) {
        const { data } = await res.json()
        set((s) => ({ decisions: [...s.decisions, data] }))
      }
    } catch (err) {
      console.error('Failed to add decision:', err)
    }
  },
  removeDecision: async (decisionId) => {
    try {
      const res = await fetch(`/api/decisions/${decisionId}`, { method: 'DELETE' })
      if (res.ok) {
        set((s) => ({ decisions: s.decisions.filter((d) => d.id !== decisionId) }))
      }
    } catch (err) {
      console.error('Failed to remove decision:', err)
    }
  },
  promoteDecision: async (decisionId, nodeType, title) => {
    try {
      await fetch(`/api/decisions/${decisionId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeType, title }),
      })
    } catch (err) {
      console.error('Failed to promote decision:', err)
    }
  },
}))
