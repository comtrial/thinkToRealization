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
import { UserAvatar } from '@/components/shared/UserAvatar'
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
  assigneeName?: string | null
  assigneeAvatarUrl?: string | null
  commentCount?: number
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
      <span className={cn(
        'text-node-title-sm truncate flex-1',
        data.status === 'done' ? 'text-text-tertiary line-through' : 'text-text-primary',
        data.status === 'archived' && 'text-text-tertiary italic',
      )}>{data.title}</span>
      {data.childCount != null && data.childCount > 0 && (
        <span className="text-micro px-1 py-0.5 rounded-badge bg-type-issue/20 text-type-issue font-medium">
          {data.childCount}
        </span>
      )}
      <StatusDot status={data.status} />
    </div>
  )
}

function ExpandedNode({ data }: { data: NodeData }) {
  return (
    <div className="w-[280px] h-[140px] p-3 flex flex-col overflow-hidden">
      {/* Priority color bar */}
      {data.priority && data.priority !== 'none' && (
        <div className={cn('absolute top-0 left-0 right-0 h-[3px] rounded-t-node', priorityColorMap[data.priority])} />
      )}
      <div className="flex items-center gap-2 shrink-0 mb-1">
        <NodeTypeIcon type={data.type} size={14} />
        <span className={cn(
          'text-[11px] font-semibold truncate flex-1',
          data.status === 'done' ? 'text-text-tertiary line-through' : 'text-text-primary',
          data.status === 'archived' && 'text-text-tertiary italic',
        )}>{data.title}</span>
        <StatusBadge status={data.status} />
      </div>
      {data.description ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MarkdownRenderer content={data.description} compact />
        </div>
      ) : (
        <div className="flex gap-3 mt-auto text-caption text-text-tertiary items-center">
          {data.childCount != null && data.childCount > 0 && (
            <span className="text-type-issue">하위 {data.childCount}</span>
          )}
          {data.sessionCount > 0 && <span>세션 {data.sessionCount}</span>}
          {data.decisionCount > 0 && <span>결정 {data.decisionCount}</span>}
          {data.fileChangeCount > 0 && <span>파일 {data.fileChangeCount}</span>}
          {data.commentCount != null && data.commentCount > 0 && <span>댓글 {data.commentCount}</span>}
          {data.latestPlanStatus && (
            <span className={cn(
              'text-micro px-1 py-0.5 rounded-badge ml-auto',
              data.latestPlanStatus === 'approved' && 'bg-green-100 text-green-700',
              data.latestPlanStatus === 'draft' && 'bg-gray-100 text-gray-600',
              data.latestPlanStatus === 'rejected' && 'bg-red-100 text-red-700',
              data.latestPlanStatus === 'revised' && 'bg-amber-100 text-amber-700',
            )}>
              {data.latestPlanStatus === 'approved' ? '\u2713 계획서' : data.latestPlanStatus === 'draft' ? '계획서' : data.latestPlanStatus === 'rejected' ? '수정필요' : '수정됨'}
            </span>
          )}
          {data.assigneeName && (
            <UserAvatar name={data.assigneeName} avatarUrl={data.assigneeAvatarUrl} size={18} className="ml-auto" />
          )}
        </div>
      )}
    </div>
  )
}

const handleStyleDesktop = { width: 12, height: 12, background: 'var(--color-accent)', border: 'none' }
const handleStyleMobile = { width: 30, height: 30, background: 'var(--color-accent)', border: 'none' }

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
    <>
      <Handle type={type} position={position} style={handleStyle} id={id} />
      {/* Overlay div above Handle to capture hover/dblclick without ReactFlow intercepting */}
      <div
        data-testid={`handle-overlay-${id}`}
        className="absolute"
        style={{
          zIndex: 30,
          ...(position === Position.Right
            ? { right: -8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, cursor: 'crosshair' }
            : { bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 28, height: 28, cursor: 'crosshair' }),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={handleDoubleClick}
      />
      {showPlus && (
        <div
          className={cn(
            'absolute z-20 rounded-full bg-accent text-white flex items-center justify-center font-bold pointer-events-none',
            isMobile ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-xs',
            position === Position.Right && 'top-1/2 -translate-y-1/2',
            position === Position.Bottom && 'left-1/2 -translate-x-1/2'
          )}
          style={{
            ...(position === Position.Right ? { right: -20 } : {}),
            ...(position === Position.Bottom ? { bottom: -20 } : {}),
          }}
        >
          +
        </div>
      )}
    </>
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
        'relative rounded-node border transition-shadow duration-zoom',
        selected ? 'border-accent border-2 shadow-elevation-2' : 'border-border',
        !selected && nodeData.status === 'in_progress' && 'border-indigo-500 border-[1.5px] bg-indigo-50 shadow-[inset_5px_0_0_0_#6366F1,0_0_12px_rgba(99,102,241,0.15)]',
        !selected && nodeData.status === 'done' && 'bg-green-50/50 border-green-300/40 opacity-70',
        !selected && nodeData.status === 'archived' && 'opacity-40 bg-gray-50',
        !selected && nodeData.status === 'backlog' && 'opacity-55 bg-gray-100/60 border-dashed border-gray-300',
        !selected && (nodeData.status === 'backlog' || nodeData.status === 'todo') && 'bg-surface',
        'hover:shadow-elevation-1'
      )}
    >
      {/* Active session indicator */}
      {nodeData.hasActiveSession && (
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-dot z-10" />
      )}

      {/* Type color bar */}
      <TypeColorBar type={nodeData.type} status={nodeData.status} />

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

      {/* Handles with explicit IDs for edge type auto-detection */}
      <Handle type="target" position={Position.Left} style={handleStyle} id="left" />
      <HandleWithPlus type="source" position={Position.Right} id="right" nodeId={id} isMobile={isMobile} />
      <Handle type="target" position={Position.Top} style={handleStyle} id="top" />
      <HandleWithPlus type="source" position={Position.Bottom} id="bottom" nodeId={id} isMobile={isMobile} />
    </div>
  )
})
