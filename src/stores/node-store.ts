import { create } from 'zustand'
import { useCanvasStore } from '@/stores/canvas-store'
import type { NodeResponse, SessionResponse, DecisionResponse } from '@/lib/types/api'

interface NodeStore {
  selectedNode: NodeResponse | null
  sessions: SessionResponse[]
  decisions: DecisionResponse[]
  isLoading: boolean
  selectNode: (nodeId: string) => Promise<void>
  clearSelection: () => void
  updateNodeStatus: (nodeId: string, status: string) => Promise<void>
  addDecision: (nodeId: string, content: string, sessionId?: string) => Promise<DecisionResponse | null>
  removeDecision: (decisionId: string) => Promise<void>
  promoteDecision: (decisionId: string, nodeType: string, title: string) => Promise<void>
  addSubIssue: (parentNodeId: string, projectId: string) => Promise<void>
}

export const useNodeStore = create<NodeStore>((set, get) => ({
  selectedNode: null,
  sessions: [],
  decisions: [],
  isLoading: false,
  selectNode: async (nodeId) => {
    // Guard: skip if already loading the same node
    const current = get()
    if (current.isLoading && current.selectedNode?.id === nodeId) return
    if (current.selectedNode?.id === nodeId && !current.isLoading) return

    set({ isLoading: true })
    try {
      const [nodeRes, sessionsRes, decisionsRes] = await Promise.all([
        fetch(`/api/nodes/${nodeId}`),
        fetch(`/api/nodes/${nodeId}/sessions`),
        fetch(`/api/nodes/${nodeId}/decisions`),
      ])
      const node = nodeRes.ok ? (await nodeRes.json()).data : null
      const sessions = sessionsRes.ok ? (await sessionsRes.json()).data : []
      const decisions = decisionsRes.ok ? (await decisionsRes.json()).data : []
      set({ selectedNode: node, sessions, decisions, isLoading: false })
    } catch (err) {
      console.error('Failed to select node:', err)
      set({ isLoading: false })
    }
  },
  clearSelection: () => set({ selectedNode: null, sessions: [], decisions: [], isLoading: false }),
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
        // Also update canvas node data
        useCanvasStore.getState().updateNodeData(nodeId, { status: data.status })
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
        return data as DecisionResponse
      }
      return null
    } catch (err) {
      console.error('Failed to add decision:', err)
      return null
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
  addSubIssue: async (parentNodeId, projectId) => {
    try {
      // Find parent node position from canvas
      const canvasStore = useCanvasStore.getState()
      const parentCanvasNode = canvasStore.nodes.find((n) => n.id === parentNodeId)
      const parentX = parentCanvasNode?.position.x ?? 0
      const parentY = parentCanvasNode?.position.y ?? 0

      // Create child issue node positioned below parent
      const res = await fetch(`/api/projects/${projectId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'issue',
          title: '새 하위 이슈',
          status: 'backlog',
          parentNodeId,
          canvasX: parentX,
          canvasY: parentY + 200,
        }),
      })
      if (!res.ok) return

      const { data: newNode } = await res.json()

      // Add node to canvas
      canvasStore.pushSnapshot()
      canvasStore.addNode({
        id: newNode.id,
        type: 'baseNode',
        position: { x: newNode.canvasX, y: newNode.canvasY },
        data: newNode,
      })

      // Create parent→child edge (type=dependency)
      const edgeRes = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: parentNodeId,
          toNodeId: newNode.id,
          type: 'dependency',
        }),
      })
      if (edgeRes.ok) {
        const { data: edgeData } = await edgeRes.json()
        canvasStore.setEdges([
          ...canvasStore.edges,
          {
            id: edgeData.id,
            source: edgeData.fromNodeId,
            target: edgeData.toNodeId,
            type: edgeData.type,
            data: edgeData,
          },
        ])
      }
    } catch (err) {
      console.error('Failed to add sub-issue:', err)
    }
  },
  promoteDecision: async (decisionId, nodeType, title) => {
    try {
      const res = await fetch(`/api/decisions/${decisionId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeType, title }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // Update decisions array with promotedToNodeId
        set((s) => ({
          decisions: s.decisions.map((d) =>
            d.id === decisionId ? { ...d, promotedToNodeId: data.newNode?.id ?? d.promotedToNodeId } : d
          ),
        }))
        // Add new node and edge to canvas
        if (data.newNode) {
          const canvasStore = useCanvasStore.getState()
          canvasStore.addNode({
            id: data.newNode.id,
            type: 'baseNode',
            position: { x: data.newNode.canvasX ?? 0, y: data.newNode.canvasY ?? 0 },
            data: data.newNode,
          })
          if (data.newEdge) {
            canvasStore.setEdges([
              ...canvasStore.edges,
              {
                id: data.newEdge.id,
                source: data.newEdge.fromNodeId,
                target: data.newEdge.toNodeId,
                type: data.newEdge.type,
                data: data.newEdge,
              },
            ])
          }
        }
      }
    } catch (err) {
      console.error('Failed to promote decision:', err)
    }
  },
}))
