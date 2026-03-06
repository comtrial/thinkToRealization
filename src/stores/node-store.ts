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
  addSubNode: (parentNodeId: string, projectId: string, parentType: string) => Promise<void>
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
      const [nodeRes, decisionsRes] = await Promise.all([
        fetch(`/api/nodes/${nodeId}`),
        fetch(`/api/nodes/${nodeId}/decisions`),
      ])
      const nodeData = nodeRes.ok ? (await nodeRes.json()).data : null
      const node = nodeData ?? null
      const sessions = node?.sessions ?? []
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
  addSubNode: async (parentNodeId, projectId, parentType) => {
    try {
      // Find parent node position from canvas
      const canvasStore = useCanvasStore.getState()
      const parentCanvasNode = canvasStore.nodes.find((n) => n.id === parentNodeId)
      const parentX = parentCanvasNode?.position.x ?? 0
      const parentY = parentCanvasNode?.position.y ?? 0

      // Create child node positioned to the right of parent (parent_child = horizontal)
      const res = await fetch(`/api/projects/${projectId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: parentType,
          title: `새 하위 ${parentType === 'planning' ? '기획' : parentType === 'feature' ? '기능' : '이슈'}`,
          status: 'backlog',
          parentNodeId,
          canvasX: parentX + 350,
          canvasY: parentY,
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

      // Create parent→child edge (horizontal = parent_child)
      const edgeRes = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: parentNodeId,
          toNodeId: newNode.id,
          type: 'parent_child',
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
            sourceHandle: 'right',
            targetHandle: 'left',
            data: edgeData,
          },
        ])
      }
    } catch (err) {
      console.error('Failed to add sub-node:', err)
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
            const edgeType = data.newEdge.type as string
            const handles = edgeType === 'related'
              ? { sourceHandle: 'bottom', targetHandle: 'top' }
              : { sourceHandle: 'right', targetHandle: 'left' }
            canvasStore.setEdges([
              ...canvasStore.edges,
              {
                id: data.newEdge.id,
                source: data.newEdge.fromNodeId,
                target: data.newEdge.toNodeId,
                type: data.newEdge.type,
                ...handles,
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
