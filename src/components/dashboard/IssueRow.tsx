'use client'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useNodeStore } from '@/stores/node-store'
import { StatusCircleIcon, PriorityIcon } from '@/components/shared/Badge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { NodeResponse } from '@/lib/types/api'

const typeAbbr: Record<string, string> = {
  planning: 'PLN', feature: 'FEA', issue: 'ISS',
}

const typeTagStyles: Record<string, string> = {
  planning: 'bg-type-idea/15 text-type-idea',
  feature: 'bg-type-task/15 text-type-task',
  issue: 'bg-type-issue/15 text-type-issue',
}

const typeLabels: Record<string, string> = {
  planning: '기획', feature: '기능개발', issue: '이슈',
}

export function IssueRow({ node }: { node: NodeResponse }) {
  const openPanel = useUIStore((s) => s.openPanel)
  const openPanelFull = useUIStore((s) => s.openPanelFull)
  const selectNode = useNodeStore((s) => s.selectNode)
  const selectedNodeId = useNodeStore((s) => s.selectedNode?.id)

  const handleClick = () => {
    selectNode(node.id)
    openPanel(node.id)
  }

  const handleDoubleClick = () => {
    selectNode(node.id)
    openPanelFull(node.id)
  }

  const shortId = `${typeAbbr[node.type] ?? 'GEN'}-${node.id.slice(-4).toUpperCase()}`

  const dateStr = node.updatedAt
    ? formatDistanceToNow(new Date(node.updatedAt), { addSuffix: false, locale: ko })
    : null

  return (
    <button
      data-testid={`dashboard-card-${node.id}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-1.5 text-body text-left',
        'hover:bg-surface-hover transition-colors duration-100',
        'border-b border-border/40',
        selectedNodeId === node.id && 'bg-accent-light'
      )}
    >
      {/* Priority */}
      <PriorityIcon priority={node.priority} size={14} />

      {/* Short ID */}
      <span className="text-caption text-text-tertiary font-mono w-[56px] flex-shrink-0 truncate">
        {shortId}
      </span>

      {/* Status circle */}
      <StatusCircleIcon status={node.status} size={14} />

      {/* Title */}
      <span className="text-node-title-sm text-text-primary truncate flex-1 text-left">
        {node.title}
      </span>

      {/* Child count (sub-issues) */}
      {node.childCount > 0 && (
        <span className="text-caption text-text-tertiary flex-shrink-0">
          {node.childCount}
        </span>
      )}

      {/* Type label tag */}
      <span className={cn(
        'text-badge px-1.5 py-0.5 rounded-badge flex-shrink-0 hidden sm:inline-flex',
        typeTagStyles[node.type] ?? 'bg-gray-100 text-gray-600'
      )}>
        {typeLabels[node.type] ?? node.type}
      </span>

      {/* Active session indicator */}
      {node.hasActiveSession && (
        <div className="w-2 h-2 rounded-full bg-status-progress animate-pulse-dot flex-shrink-0" />
      )}

      {/* Date */}
      {dateStr && (
        <span className="text-caption text-text-tertiary flex-shrink-0 w-[60px] text-right hidden sm:block">
          {dateStr}
        </span>
      )}
    </button>
  )
}
