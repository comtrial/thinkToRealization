import { create } from 'zustand'
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

interface Snapshot {
  nodes: Node[]
  edges: Edge[]
}

function getMaxHistory(): number {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
    return 10
  }
  return 15
}

/** Determine edge type from source handle */
function edgeTypeFromHandle(sourceHandle: string | null | undefined): string {
  return sourceHandle === 'bottom' ? 'related' : 'parent_child'
}

/** Derive sourceHandle/targetHandle from edge type */
function handlesFromType(type: string): { sourceHandle: string; targetHandle: string } {
  if (type === 'related') return { sourceHandle: 'bottom', targetHandle: 'top' }
  return { sourceHandle: 'right', targetHandle: 'left' }
}

interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  undoStack: Snapshot[]
  redoStack: Snapshot[]
  initialViewport: { x: number; y: number; zoom: number } | null
  isZoomedIn: boolean
  loadedProjectId: string | null
  _pendingReload: boolean
  invalidateCanvas: () => void
  setIsZoomedIn: (value: boolean) => void
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: Node) => void
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void
  removeNode: (id: string) => void
  pushSnapshot: () => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  loadCanvas: (projectId: string) => Promise<void>
  savePositions: (nodes: { id: string; x: number; y: number }[]) => Promise<void>
  saveViewport: (projectId: string, viewport: { x: number; y: number; zoom: number }) => void
}

let viewportSaveTimer: NodeJS.Timeout | undefined

async function reconcileWithAPI(prev: Snapshot, next: Snapshot) {
  const prevNodeIds = new Set(prev.nodes.map((n) => n.id))
  const nextNodeIds = new Set(next.nodes.map((n) => n.id))
  const prevEdgeIds = new Set(prev.edges.map((e) => e.id))
  const nextEdgeIds = new Set(next.edges.map((e) => e.id))

  const promises: Promise<unknown>[] = []

  // Nodes that appeared (were deleted before, now restored) → unarchive
  for (const node of next.nodes) {
    if (!prevNodeIds.has(node.id)) {
      const originalStatus = (node.data as Record<string, unknown>)?.status as string | undefined
      promises.push(
        fetch(`/api/nodes/${node.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: originalStatus || 'backlog' }),
        })
      )
    }
  }

  // Nodes that disappeared → archive
  for (const node of prev.nodes) {
    if (!nextNodeIds.has(node.id)) {
      promises.push(fetch(`/api/nodes/${node.id}`, { method: 'DELETE' }))
    }
  }

  // Edges that appeared → recreate
  for (const edge of next.edges) {
    if (!prevEdgeIds.has(edge.id)) {
      promises.push(
        fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: edge.source,
            toNodeId: edge.target,
            type: (edge.data as Record<string, unknown>)?.type || edge.type || 'parent_child',
          }),
        })
      )
    }
  }

  // Edges that disappeared → delete
  for (const edge of prev.edges) {
    if (!nextEdgeIds.has(edge.id)) {
      promises.push(fetch(`/api/edges/${edge.id}`, { method: 'DELETE' }))
    }
  }

  // Position changes
  const movedNodes = next.nodes.filter((n) => {
    const prevNode = prev.nodes.find((p) => p.id === n.id)
    return prevNode && (prevNode.position.x !== n.position.x || prevNode.position.y !== n.position.y)
  })
  if (movedNodes.length > 0) {
    promises.push(
      fetch('/api/nodes/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: movedNodes.map((n) => ({ id: n.id, canvasX: n.position.x, canvasY: n.position.y })),
        }),
      })
    )
  }

  await Promise.allSettled(promises)
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  undoStack: [],
  redoStack: [],
  initialViewport: null,
  isZoomedIn: true,
  loadedProjectId: null,
  _pendingReload: false,
  invalidateCanvas: () => set({ _pendingReload: true }),
  setIsZoomedIn: (value) => set({ isZoomedIn: value }),
  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: async (connection) => {
    // Save snapshot before connecting
    get().pushSnapshot()

    // Auto-detect edge type from source handle
    const edgeType = edgeTypeFromHandle(connection.sourceHandle)
    const handles = handlesFromType(edgeType)

    // Add edge locally with proper type and handles
    const tempEdge: Edge = {
      id: `temp-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: edgeType,
    }
    set({ edges: [...get().edges, tempEdge] })

    // Persist via API
    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: connection.source,
          toNodeId: connection.target,
          type: edgeType,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // Update with server-assigned ID
        set((s) => ({
          edges: s.edges.map((e) =>
            e.id === tempEdge.id
              ? {
                  ...e,
                  id: data.id,
                  type: data.type,
                  data,
                  ...handlesFromType(data.type),
                }
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
  pushSnapshot: () => {
    const { nodes, edges, undoStack } = get()
    const snapshot: Snapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }
    const newStack = [...undoStack, snapshot]
    const maxHistory = getMaxHistory()
    while (newStack.length > maxHistory) newStack.shift()
    set({ undoStack: newStack, redoStack: [] })
  },
  undo: async () => {
    const { undoStack, nodes, edges } = get()
    if (undoStack.length === 0) return

    const newUndoStack = [...undoStack]
    const snapshot = newUndoStack.pop()!
    const currentSnapshot: Snapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }

    set({
      undoStack: newUndoStack,
      redoStack: [...get().redoStack, currentSnapshot],
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    })

    await reconcileWithAPI(currentSnapshot, snapshot)
  },
  redo: async () => {
    const { redoStack, nodes, edges } = get()
    if (redoStack.length === 0) return

    const newRedoStack = [...redoStack]
    const snapshot = newRedoStack.pop()!
    const currentSnapshot: Snapshot = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }

    set({
      redoStack: newRedoStack,
      undoStack: [...get().undoStack, currentSnapshot],
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    })

    await reconcileWithAPI(currentSnapshot, snapshot)
  },
  loadCanvas: async (projectId) => {
    // Skip if already loaded for this project (use forceReload to bypass)
    if (get().loadedProjectId === projectId && !get()._pendingReload) return
    set({ _pendingReload: false })

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
      const edges: Edge[] = data.edges.map((e: Record<string, unknown>) => {
        const type = e.type as string
        const handles = handlesFromType(type)
        return {
          id: e.id,
          source: e.fromNodeId,
          target: e.toNodeId,
          type,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          data: e,
        }
      })
      const hasViewport = data.viewport && (data.viewport.x !== 0 || data.viewport.y !== 0 || data.viewport.zoom !== 1)
      set({
        nodes,
        edges,
        initialViewport: hasViewport ? data.viewport : null,
        undoStack: [],
        redoStack: [],
        loadedProjectId: projectId,
      })
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
  saveViewport: (projectId, viewport) => {
    if (viewportSaveTimer) clearTimeout(viewportSaveTimer)
    viewportSaveTimer = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/canvas/viewport`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(viewport),
        })
      } catch (err) {
        console.error('Failed to save viewport:', err)
      }
    }, 1000)
  },
}))
