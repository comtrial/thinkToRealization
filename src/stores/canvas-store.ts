import { create } from 'zustand'
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'

interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  isZoomedIn: boolean
  setIsZoomedIn: (value: boolean) => void
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: Node) => void
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void
  removeNode: (id: string) => void
  loadCanvas: (projectId: string) => Promise<void>
  savePositions: (nodes: { id: string; x: number; y: number }[]) => Promise<void>
  saveViewport: (projectId: string, viewport: { x: number; y: number; zoom: number }) => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  isZoomedIn: true,
  setIsZoomedIn: (value) => set({ isZoomedIn: value }),
  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: async (connection) => {
    // Optimistic: add edge locally
    set({ edges: addEdge(connection, get().edges) })
    // Persist via API
    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: connection.source,
          toNodeId: connection.target,
          type: 'sequence',
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // Update with server-assigned ID
        set((s) => ({
          edges: s.edges.map((e) =>
            e.source === connection.source && e.target === connection.target && !e.data
              ? { ...e, id: data.id, type: data.type, data }
              : e
          ),
        }))
      }
    } catch (err) {
      console.error('Failed to create edge:', err)
    }
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),
  loadCanvas: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas`)
      if (!res.ok) return
      const { data } = await res.json()
      const nodes: Node[] = data.nodes.map((n: Record<string, unknown>) => ({
        id: n.id as string,
        type: 'baseNode',
        position: { x: n.canvasX as number, y: n.canvasY as number },
        data: n,
      }))
      const edges: Edge[] = data.edges.map((e: Record<string, unknown>) => ({
        id: e.id,
        source: e.fromNodeId,
        target: e.toNodeId,
        type: e.type,
        data: e,
      }))
      set({ nodes, edges })
    } catch (err) {
      console.error('Failed to load canvas:', err)
    }
  },
  savePositions: async (nodePositions) => {
    try {
      await fetch('/api/nodes/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodePositions.map(n => ({ id: n.id, canvasX: n.x, canvasY: n.y })) }),
      })
    } catch (err) {
      console.error('Failed to save positions:', err)
    }
  },
  saveViewport: async (projectId, viewport) => {
    try {
      await fetch(`/api/projects/${projectId}/canvas/viewport`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viewport),
      })
    } catch (err) {
      console.error('Failed to save viewport:', err)
    }
  },
}))
