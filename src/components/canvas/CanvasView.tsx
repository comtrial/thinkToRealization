'use client'

import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type Node,
  type OnMoveEnd,
  type OnConnectEnd,
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
import type { NodeType } from '@/lib/types/api'

const nodeTypes = { baseNode: BaseNode }
const edgeTypes = { sequence: CustomEdge, dependency: CustomEdge, related: CustomEdge, regression: CustomEdge, branch: CustomEdge }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94A3B8' } }

const SAVE_DEBOUNCE_MS = 500

function CanvasInner({ projectId }: { projectId: string }) {
  const {
    nodes,
    edges,
    initialViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isZoomedIn,
    setIsZoomedIn,
    loadCanvas,
    savePositions,
    saveViewport,
    setNodes,
    addNode,
    pushSnapshot,
    setEdges,
  } = useCanvasStore()

  const openPanel = useUIStore((s) => s.openPanel)
  const isMobile = useMobile()
  const [fabOpen, setFabOpen] = useState(false)
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow()
  const saveTimerRef = useRef<NodeJS.Timeout>()
  const contextPosRef = useRef({ x: 0, y: 0 })
  const connectingNodeRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  useEffect(() => {
    loadCanvas(projectId)
  }, [projectId, loadCanvas])

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      const newIsZoomedIn = viewport.zoom > 0.8
      if (newIsZoomedIn !== isZoomedIn) {
        setIsZoomedIn(newIsZoomedIn)
      }
    },
    [isZoomedIn, setIsZoomedIn]
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
            title: `새 ${type === 'idea' ? '아이디어' : type === 'task' ? '작업' : type === 'decision' ? '결정' : type === 'issue' ? '이슈' : type === 'milestone' ? '마일스톤' : '메모'}`,
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

      const newNode = await handleCreateNode('task', position)
      if (!newNode) return

      try {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: nodeId,
            toNodeId: newNode.id,
            type: 'sequence',
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

      const newNode = await handleCreateNode('task', position)
      if (!newNode) return

      // Create edge from source to new node
      try {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: connecting.nodeId,
            toNodeId: newNode.id,
            type: 'sequence',
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
          onMoveEnd={handleMoveEnd}
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
                  idea: '#FBBF24', task: '#3B82F6', decision: '#8B5CF6',
                  issue: '#F87171', milestone: '#10B981', note: '#A3A3A3',
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
