'use client'

import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas-store'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { StatusBadge, StatusDot, TypeColorBar } from '@/components/shared/Badge'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import type { NodeType, NodeStatus } from '@/lib/types/api'

interface NodeData {
  type: NodeType
  title: string
  description?: string | null
  status: NodeStatus
  sessionCount: number
  decisionCount: number
  fileChangeCount: number
  hasActiveSession: boolean
  [key: string]: unknown
}

function CompactNode({ data }: { data: NodeData }) {
  return (
    <div className="w-[200px] h-[52px] flex items-center px-3 gap-2">
      <NodeTypeIcon type={data.type} size={16} />
      <span className="text-node-title-sm text-text-primary truncate flex-1">{data.title}</span>
      <StatusDot status={data.status} />
    </div>
  )
}

function ExpandedNode({ data }: { data: NodeData }) {
  return (
    <div className="w-[280px] h-[140px] p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <NodeTypeIcon type={data.type} size={16} />
        <span className="text-node-title-lg text-text-primary truncate flex-1">{data.title}</span>
        <StatusBadge status={data.status} />
      </div>
      {data.description && (
        <div className="line-clamp-2 overflow-hidden">
          <MarkdownRenderer content={data.description} compact />
        </div>
      )}
      <div className="flex gap-3 mt-auto text-caption text-text-tertiary">
        {data.sessionCount > 0 && <span>세션 {data.sessionCount}</span>}
        {data.decisionCount > 0 && <span>결정 {data.decisionCount}</span>}
        {data.fileChangeCount > 0 && <span>파일 {data.fileChangeCount}</span>}
      </div>
    </div>
  )
}

const handleStyle = { width: 8, height: 8, background: '#4F46E5', border: 'none' }

function HandleWithPlus({
  type,
  position,
  id,
}: {
  type: 'source' | 'target'
  position: Position
  id?: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type={type} position={position} style={handleStyle} id={id} />
      {hovered && type === 'source' && (
        <div
          className={cn(
            'absolute z-20 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold pointer-events-none',
            position === Position.Right && 'left-2 top-1/2 -translate-y-1/2',
            position === Position.Bottom && 'top-2 left-1/2 -translate-x-1/2'
          )}
        >
          +
        </div>
      )}
    </div>
  )
}

export const BaseNode = memo(function BaseNode({ data, selected }: NodeProps) {
  const isZoomedIn = useCanvasStore((s) => s.isZoomedIn)
  const nodeData = data as unknown as NodeData

  return (
    <div
      className={cn(
        'relative rounded-node border bg-surface transition-shadow duration-zoom',
        selected ? 'border-accent border-2 shadow-elevation-2' : 'border-border',
        nodeData.status === 'in_progress' && !selected && 'border-accent/30',
        'hover:shadow-elevation-1'
      )}
    >
      {/* Active session indicator */}
      {nodeData.hasActiveSession && (
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-dot z-10" />
      )}

      {/* Type color bar */}
      <TypeColorBar type={nodeData.type} />

      {/* Level 1: Compact (zoom <= 80%) */}
      <div
        className={cn(
          'transition-opacity duration-zoom',
          isZoomedIn ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'
        )}
      >
        <CompactNode data={nodeData} />
      </div>

      {/* Level 2: Expanded (zoom > 80%) */}
      <div
        className={cn(
          'transition-opacity duration-zoom',
          isZoomedIn ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
        )}
      >
        <ExpandedNode data={nodeData} />
      </div>

      {/* Handles - target handles stay simple, source handles get "+" on hover */}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <HandleWithPlus type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} style={handleStyle} id="top" />
      <HandleWithPlus type="source" position={Position.Bottom} id="bottom" />
    </div>
  )
})
