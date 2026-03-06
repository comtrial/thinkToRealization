'use client'

import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  reconnectEdge,
  type Viewport,
  type Node,
  type OnMoveEnd,
  type OnConnectEnd,
  type OnReconnect,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas-store'
import { useUIStore } from '@/stores/ui-store'
import { useMobile } from '@/hooks/useMobile'
import { BaseNode } from './BaseNode'
import { CustomEdge } from './CustomEdge'
import { CanvasContextMenu, nodeTypeOptions } from './CanvasContextMenu'
import type { NodeType, EdgeType } from '@/lib/types/api'

const nodeTypes = { baseNode: BaseNode }
const edgeTypes = {
  parent_child: CustomEdge,
  related: CustomEdge,
  // Legacy types
  sequence: CustomEdge,
  dependency: CustomEdge,
  regression: CustomEdge,
  branch: CustomEdge,
}
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94A3B8' } }

const SAVE_DEBOUNCE_MS = 500

/** Determine edge type from source handle position */
function edgeTypeFromHandle(sourceHandle: string | null | undefined): EdgeType {
  return sourceHandle === 'bottom' ? 'related' : 'parent_child'
}

/** Determine sourceHandle/targetHandle from edge type */
export function handlesFromEdgeType(type: string): { sourceHandle: string; targetHandle: string } {
  if (type === 'related') return { sourceHandle: 'bottom', targetHandle: 'top' }
  // parent_child and all legacy types → horizontal
  return { sourceHandle: 'right', targetHandle: 'left' }
}

function CanvasInner({ projectId }: { projectId: string }) {
  // Data selectors — only re-render when these values change
  const { nodes, edges, initialViewport, isZoomedIn } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      initialViewport: s.initialViewport,
      isZoomedIn: s.isZoomedIn,
    }))
  )

  // Stable function references — no re-render on subscription
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const setIsZoomedIn = useCanvasStore((s) => s.setIsZoomedIn)
  const loadCanvas = useCanvasStore((s) => s.loadCanvas)
  const savePositions = useCanvasStore((s) => s.savePositions)
  const saveViewport = useCanvasStore((s) => s.saveViewport)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const addNode = useCanvasStore((s) => s.addNode)
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot)
  const setEdges = useCanvasStore((s) => s.setEdges)

  const openPanel = useUIStore((s) => s.openPanel)
  const openPanelFull = useUIStore((s) => s.openPanelFull)
  const isMobile = useMobile()
  const [fabOpen, setFabOpen] = useState(false)
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow()
  const saveTimerRef = useRef<NodeJS.Timeout>()
  const contextPosRef = useRef({ x: 0, y: 0 })
  const connectingNodeRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  useEffect(() => {
    loadCanvas(projectId)
  }, [projectId, loadCanvas])

  const isZoomedInRef = useRef(isZoomedIn)
  useEffect(() => { isZoomedInRef.current = isZoomedIn }, [isZoomedIn])

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      const newIsZoomedIn = viewport.zoom > 0.8
      if (newIsZoomedIn !== isZoomedInRef.current) {
        setIsZoomedIn(newIsZoomedIn)
      }
    },
    [setIsZoomedIn]
  )

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      pushSnapshot()
      deleted.forEach((node) => {
        fetch(`/api/nodes/${node.id}`, { method: 'DELETE' }).catch((err) =>
          console.error('Failed to delete node:', err)
        )
      })
    },
    [pushSnapshot]
  )

  const handleEdgesDelete = useCallback(
    (deleted: { id: string }[]) => {
      pushSnapshot()
      deleted.forEach((edge) => {
        fetch(`/api/edges/${edge.id}`, { method: 'DELETE' }).catch((err) =>
          console.error('Failed to delete edge:', err)
        )
      })
    },
    [pushSnapshot]
  )

  const handleNodeDragStart = useCallback(() => {
    pushSnapshot()
  }, [pushSnapshot])

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const positions = draggedNodes.map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
        }))
        savePositions(positions)
      }, SAVE_DEBOUNCE_MS)
    },
    [savePositions]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      openPanel(node.id)
    },
    [openPanel]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      openPanelFull(node.id)
    },
    [openPanelFull]
  )

  const handleMoveEnd: OnMoveEnd = useCallback(
    (_event, viewport) => {
      saveViewport(projectId, viewport)
    },
    [projectId, saveViewport]
  )

  const handleCreateNode = useCallback(
    async (type: NodeType, position: { x: number; y: number }) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title: `새 ${type === 'planning' ? '기획' : type === 'feature' ? '기능개발' : '이슈'}`,
            canvasX: position.x,
            canvasY: position.y,
          }),
        })
        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}))
          console.error('Node creation API error:', res.status, errorBody)
          return null
        }
        const { data } = await res.json()
        pushSnapshot()
        addNode({
          id: data.id,
          type: 'baseNode',
          position: { x: data.canvasX, y: data.canvasY },
          data,
        })
        return data
      } catch (err) {
        console.error('Failed to create node:', err)
        return null
      }
    },
    [projectId, addNode, pushSnapshot]
  )

  // Handle double-click on node handles to auto-create connected nodes
  useEffect(() => {
    const handler = async (e: Event) => {
      const { nodeId, handlePosition } = (e as CustomEvent).detail as {
        nodeId: string
        handlePosition: 'right' | 'bottom'
      }
      const sourceNode = nodes.find((n) => n.id === nodeId)
      if (!sourceNode) return

      const offset = handlePosition === 'right' ? { x: 350, y: 0 } : { x: 0, y: 200 }
      const position = {
        x: sourceNode.position.x + offset.x,
        y: sourceNode.position.y + offset.y,
      }

      const sourceType = (sourceNode.data as { type: string }).type as NodeType
      const newNode = await handleCreateNode(sourceType, position)
      if (!newNode) return

      // Auto-detect edge type from handle position
      const edgeType = edgeTypeFromHandle(handlePosition === 'right' ? 'right' : 'bottom')
      const handles = handlesFromEdgeType(edgeType)

      try {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: nodeId,
            toNodeId: newNode.id,
            type: edgeType,
          }),
        })
        if (res.ok) {
          const { data: edgeData } = await res.json()
          setEdges([
            ...useCanvasStore.getState().edges,
            {
              id: edgeData.id,
              source: edgeData.fromNodeId,
              target: edgeData.toNodeId,
              type: edgeData.type,
              sourceHandle: handles.sourceHandle,
              targetHandle: handles.targetHandle,
              data: edgeData,
            },
          ])
        }
      } catch (err) {
        console.error('Failed to create edge:', err)
      }
    }

    window.addEventListener('handle-double-click', handler)
    return () => window.removeEventListener('handle-double-click', handler)
  }, [nodes, handleCreateNode, setEdges])

  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null }) => {
      if (params.nodeId) {
        connectingNodeRef.current = { nodeId: params.nodeId, handleId: params.handleId }
      }
    },
    []
  )

  const handleConnectEnd: OnConnectEnd = useCallback(
    async (event) => {
      const connecting = connectingNodeRef.current
      connectingNodeRef.current = null

      if (!connecting) return

      // Check if we dropped on a valid target (another handle)
      const target = event.target as HTMLElement
      if (target.classList.contains('react-flow__handle')) return

      // Dropped on empty canvas — create a new node and connect
      const mouseEvent = event as unknown as MouseEvent
      const position = screenToFlowPosition({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      })

      const newNode = await handleCreateNode('feature', position)
      if (!newNode) return

      // Auto-detect edge type from source handle
      const edgeType = edgeTypeFromHandle(connecting.handleId)
      const handles = handlesFromEdgeType(edgeType)

      // Create edge from source to new node
      try {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: connecting.nodeId,
            toNodeId: newNode.id,
            type: edgeType,
          }),
        })
        if (res.ok) {
          const { data: edgeData } = await res.json()
          setEdges([
            ...useCanvasStore.getState().edges,
            {
              id: edgeData.id,
              source: edgeData.fromNodeId,
              target: edgeData.toNodeId,
              type: edgeData.type,
              sourceHandle: handles.sourceHandle,
              targetHandle: handles.targetHandle,
              data: edgeData,
            },
          ])
        }
      } catch (err) {
        console.error('Failed to create edge:', err)
      }
    },
    [screenToFlowPosition, handleCreateNode, setEdges]
  )

  // Edge reconnection handler
  const handleReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      pushSnapshot()

      // Determine new edge type from source handle
      const newType = edgeTypeFromHandle(newConnection.sourceHandle)
      const handles = handlesFromEdgeType(newType)

      // Apply reconnection locally
      const updatedEdges = reconnectEdge(oldEdge, newConnection, useCanvasStore.getState().edges)
      // Set correct type and handles on the reconnected edge
      const finalEdges = updatedEdges.map((e) => {
        if (
          e.source === newConnection.source &&
          e.target === newConnection.target &&
          (e.sourceHandle === newConnection.sourceHandle || e.id === oldEdge.id)
        ) {
          return {
            ...e,
            type: newType,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            data: { ...e.data, type: newType, fromNodeId: newConnection.source, toNodeId: newConnection.target },
          }
        }
        return e
      })
      setEdges(finalEdges)

      // Persist: delete old + create new if source/target changed, otherwise just update type
      const sourceChanged = oldEdge.source !== newConnection.source || oldEdge.target !== newConnection.target
      const oldType = (oldEdge.data as Record<string, unknown>)?.type as string
      const typeChanged = oldType !== newType

      if (sourceChanged) {
        // Delete old edge, create new one
        fetch(`/api/edges/${oldEdge.id}`, { method: 'DELETE' })
          .then(() =>
            fetch('/api/edges', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromNodeId: newConnection.source,
                toNodeId: newConnection.target,
                type: newType,
              }),
            })
          )
          .then(async (res) => {
            if (res.ok) {
              const { data } = await res.json()
              // Update local edge with server ID
              setEdges(
                useCanvasStore.getState().edges.map((e) =>
                  e.source === newConnection.source &&
                  e.target === newConnection.target &&
                  e.type === newType
                    ? { ...e, id: data.id, data }
                    : e
                )
              )
            }
          })
          .catch((err) => console.error('Failed to reconnect edge:', err))
      } else if (typeChanged) {
        // Same endpoints, just type changed (handle position change on same node)
        fetch(`/api/edges/${oldEdge.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: newType }),
        }).catch((err) => console.error('Failed to update edge type:', err))
      }
    },
    [pushSnapshot, setEdges]
  )

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    pushSnapshot()

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 })

    const nodeWidth = isZoomedIn ? 280 : 200
    const nodeHeight = isZoomedIn ? 140 : 52

    nodes.forEach((node) => {
      g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    })
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target)
    })

    dagre.layout(g)

    const newNodes = nodes.map((node) => {
      const pos = g.node(node.id)
      return {
        ...node,
        position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 },
      }
    })

    setNodes(newNodes)

    // Save after layout animation
    setTimeout(() => {
      const positions = newNodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      }))
      savePositions(positions)
      fitView({ duration: 300 })
    }, 350)
  }, [nodes, edges, isZoomedIn, setNodes, savePositions, fitView, pushSnapshot])

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    contextPosRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  return (
    <CanvasContextMenu
      onCreateNode={handleCreateNode}
      screenToFlowPosition={screenToFlowPosition}
      contextPositionRef={contextPosRef}
    >
      <div className="w-full h-full" onContextMenu={handleContextMenu}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onNodeDragStart={handleNodeDragStart}
          onViewportChange={handleViewportChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onMoveEnd={handleMoveEnd}
          onReconnect={handleReconnect}
          edgesReconnectable
          reconnectRadius={20}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={initialViewport ?? undefined}
          fitView={!initialViewport}
          minZoom={0.25}
          maxZoom={2}
          proOptions={proOptions}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background variant={BackgroundVariant.Dots} color="#E5E5E3" gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="bg-surface border border-border rounded-button shadow-elevation-1"
          />
          {!isMobile && (
            <MiniMap
              style={{ width: 120, height: 80 }}
              nodeColor={(node) => {
                const type = (node.data as Record<string, unknown>)?.type as string
                const colors: Record<string, string> = {
                  planning: '#FBBF24', feature: '#3B82F6', issue: '#F87171',
                }
                return colors[type] || '#A3A3A3'
              }}
              maskColor="rgba(250, 250, 249, 0.7)"
              className="bg-surface border border-border rounded-node"
            />
          )}
        </ReactFlow>
        {/* Auto-layout button */}
        <button
          data-testid="auto-layout-btn"
          onClick={handleAutoLayout}
          className={cn(
            'absolute right-4 rounded-button text-badge bg-surface border border-border text-text-secondary hover:bg-surface-hover shadow-elevation-1 transition-colors z-10',
            isMobile ? 'bottom-6 min-w-[44px] min-h-[44px] px-3 py-2' : 'bottom-4 px-3 py-1.5'
          )}
          title="자동 정렬 (Cmd+L)"
        >
          자동 정렬
        </button>
        {/* Mobile FAB for node creation */}
        {isMobile && (
          <div className="absolute bottom-[72px] right-4 z-20">
            {fabOpen && (
              <div className="mb-2 min-w-[200px] bg-surface rounded-dropdown border border-border shadow-elevation-2 py-1">
                {nodeTypeOptions.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    className="flex items-center gap-2 w-full px-3 py-3 text-body text-text-primary active:bg-surface-hover outline-none"
                    onClick={() => {
                      const viewport = getViewport()
                      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom
                      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom
                      handleCreateNode(type, { x: centerX, y: centerY })
                      setFabOpen(false)
                    }}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setFabOpen((v) => !v)}
              className="w-14 h-14 rounded-full bg-accent text-white shadow-elevation-2 flex items-center justify-center active:bg-accent/90 transition-colors"
              aria-label="노드 추가"
            >
              <Plus size={24} className={cn('transition-transform', fabOpen && 'rotate-45')} />
            </button>
          </div>
        )}
      </div>
    </CanvasContextMenu>
  )
}

export function CanvasView({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full">
        <CanvasInner projectId={projectId} />
      </div>
    </ReactFlowProvider>
  )
}
