'use client'

import { useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type Node,
  type OnMoveEnd,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useCanvasStore } from '@/stores/canvas-store'
import { useNodeStore } from '@/stores/node-store'
import { BaseNode } from './BaseNode'
import { CustomEdge } from './CustomEdge'
import { CanvasContextMenu } from './CanvasContextMenu'
import type { NodeType } from '@/lib/types/api'

const nodeTypes = { baseNode: BaseNode }
const edgeTypes = { sequence: CustomEdge, dependency: CustomEdge, related: CustomEdge, regression: CustomEdge, branch: CustomEdge }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94A3B8' } }

const SAVE_DEBOUNCE_MS = 500

function CanvasInner({ projectId }: { projectId: string }) {
  const {
    nodes,
    edges,
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
  } = useCanvasStore()

  const selectNode = useNodeStore((s) => s.selectNode)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const saveTimerRef = useRef<NodeJS.Timeout>()
  const contextPosRef = useRef({ x: 0, y: 0 })

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
      selectNode(node.id)
    },
    [selectNode]
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
        if (res.ok) {
          const { data } = await res.json()
          addNode({
            id: data.id,
            type: 'baseNode',
            position: { x: data.canvasX, y: data.canvasY },
            data,
          })
        }
      } catch (err) {
        console.error('Failed to create node:', err)
      }
    },
    [projectId, addNode]
  )

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return

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
  }, [nodes, edges, isZoomedIn, setNodes, savePositions, fitView])

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    contextPosRef.current = { x: event.clientX, y: event.clientY }
    const wrapper = event.currentTarget as HTMLElement
    wrapper.setAttribute('data-context-position', JSON.stringify(contextPosRef.current))
  }, [])

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  return (
    <CanvasContextMenu
      onCreateNode={handleCreateNode}
      screenToFlowPosition={screenToFlowPosition}
    >
      <div className="w-full h-full" onContextMenu={handleContextMenu} data-context-position="">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onViewportChange={handleViewportChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onMoveEnd={handleMoveEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
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
          <MiniMap
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
        </ReactFlow>
        {/* Auto-layout button */}
        <button
          onClick={handleAutoLayout}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-button text-badge bg-surface border border-border text-text-secondary hover:bg-surface-hover shadow-elevation-1 transition-colors z-10"
          title="자동 정렬 (Cmd+L)"
        >
          자동 정렬
        </button>
      </div>
    </CanvasContextMenu>
  )
}

export function CanvasView({ projectId }: { projectId: string }) {
  return (
    <div className="w-full h-full">
      <CanvasInner projectId={projectId} />
    </div>
  )
}
