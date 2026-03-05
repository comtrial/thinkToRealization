'use client'

import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas-store'
import { useMobile } from '@/hooks/useMobile'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { StatusBadge, StatusDot, TypeColorBar } from '@/components/shared/Badge'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import type { NodeType, NodeStatus } from '@/lib/types/api'

interface NodeData {
  type: NodeType
  title: string
  description?: string | null
  status: NodeStatus
  priority?: string
  sessionCount: number
  decisionCount: number
  fileChangeCount: number
  childCount?: number
  planCount?: number
  latestPlanStatus?: string | null
  hasActiveSession: boolean
  [key: string]: unknown
}

const priorityColorMap: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
  none: '',
}

function CompactNode({ data }: { data: NodeData }) {
  return (
    <div className="w-[200px] h-[52px] flex items-center px-3 gap-2">
      <NodeTypeIcon type={data.type} size={16} />
      <span className="text-node-title-sm text-text-primary truncate flex-1">{data.title}</span>
      {data.type === 'issue' && data.childCount != null && data.childCount > 0 && (
        <span className="text-[10px] px-1 py-0.5 rounded-badge bg-type-issue/20 text-type-issue font-medium">
          {data.childCount}
        </span>
      )}
      <StatusDot status={data.status} />
    </div>
  )
}

function ExpandedNode({ data }: { data: NodeData }) {
  const isIssue = data.type === 'issue'
  return (
    <div className="w-[280px] h-[140px] p-3 flex flex-col gap-1">
      {/* Priority color bar for issues */}
      {isIssue && data.priority && data.priority !== 'none' && (
        <div className={cn('absolute top-0 left-0 right-0 h-[3px] rounded-t-node', priorityColorMap[data.priority])} />
      )}
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
      <div className="flex gap-3 mt-auto text-caption text-text-tertiary items-center">
        {isIssue && data.childCount != null && data.childCount > 0 && (
          <span className="text-type-issue">하위 {data.childCount}</span>
        )}
        {data.sessionCount > 0 && <span>세션 {data.sessionCount}</span>}
        {data.decisionCount > 0 && <span>결정 {data.decisionCount}</span>}
        {data.fileChangeCount > 0 && <span>파일 {data.fileChangeCount}</span>}
        {data.latestPlanStatus && (
          <span className={cn(
            'text-[10px] px-1 py-0.5 rounded-badge ml-auto',
            data.latestPlanStatus === 'approved' && 'bg-green-100 text-green-700',
            data.latestPlanStatus === 'draft' && 'bg-gray-100 text-gray-600',
            data.latestPlanStatus === 'rejected' && 'bg-red-100 text-red-700',
            data.latestPlanStatus === 'revised' && 'bg-amber-100 text-amber-700',
          )}>
            {data.latestPlanStatus === 'approved' ? '\u2713 계획서' : data.latestPlanStatus === 'draft' ? '계획서' : data.latestPlanStatus === 'rejected' ? '수정필요' : '수정됨'}
          </span>
        )}
      </div>
    </div>
  )
}

const handleStyleDesktop = { width: 8, height: 8, background: '#4F46E5', border: 'none' }
const handleStyleMobile = { width: 20, height: 20, background: '#4F46E5', border: 'none' }

function HandleWithPlus({
  type,
  position,
  id,
  nodeId,
  isMobile,
}: {
  type: 'source' | 'target'
  position: Position
  id?: string
  nodeId?: string
  isMobile: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const handleStyle = isMobile ? handleStyleMobile : handleStyleDesktop

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type !== 'source' || !nodeId) return
    window.dispatchEvent(
      new CustomEvent('handle-double-click', {
        detail: { nodeId, handlePosition: position === Position.Right ? 'right' : 'bottom' },
      })
    )
  }

  const showPlus = type === 'source' && (isMobile || hovered)

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type={type} position={position} style={handleStyle} id={id} />
      {showPlus && (
        <div
          className={cn(
            'absolute z-20 rounded-full bg-accent text-white flex items-center justify-center font-bold pointer-events-none',
            isMobile ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[10px]',
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

export const BaseNode = memo(function BaseNode({ id, data, selected }: NodeProps) {
  const isZoomedIn = useCanvasStore((s) => s.isZoomedIn)
  const isMobile = useMobile()
  const nodeData = data as unknown as NodeData
  const handleStyle = isMobile ? handleStyleMobile : handleStyleDesktop

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

      {/* Handles - target handles stay simple, source handles get "+" on hover/double-click */}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <HandleWithPlus type="source" position={Position.Right} nodeId={id} isMobile={isMobile} />
      <Handle type="target" position={Position.Top} style={handleStyle} id="top" />
      <HandleWithPlus type="source" position={Position.Bottom} id="bottom" nodeId={id} isMobile={isMobile} />
    </div>
  )
})
