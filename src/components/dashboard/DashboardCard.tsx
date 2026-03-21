'use client'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useNodeStore } from '@/stores/node-store'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { StatusBadge } from '@/components/shared/Badge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { NodeResponse } from '@/lib/types/api'

const typeColorBarMap: Record<string, string> = {
  planning: 'bg-type-idea',
  feature: 'bg-type-task',
  issue: 'bg-type-issue',
}

interface DashboardCardProps {
  node: NodeResponse
  compact?: boolean
}

export function DashboardCard({ node, compact = false }: DashboardCardProps) {
  const openPanel = useUIStore((s) => s.openPanel)
  const selectNode = useNodeStore((s) => s.selectNode)

  const handleClick = () => {
    selectNode(node.id)
    openPanel(node.id)
  }

  const lastWorkTime = node.lastSessionAt
    ? formatDistanceToNow(new Date(node.lastSessionAt), { addSuffix: true, locale: ko })
    : null

  if (compact) {
    return (
      <button
        data-testid={`dashboard-card-${node.id}`}
        onClick={handleClick}
        className={cn(
          'relative w-full text-left rounded-node border border-border bg-surface',
          'px-lg py-md flex items-center gap-md',
          'hover:shadow-elevation-1 transition-shadow duration-150',
          'overflow-hidden'
        )}
      >
        <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-node', typeColorBarMap[node.type] ?? 'bg-gray-400')} />
        <NodeTypeIcon type={node.type} size={16} />
        <span className="text-node-title-sm text-text-primary truncate flex-1">{node.title}</span>
        {lastWorkTime && (
          <span className="text-caption text-text-tertiary flex-shrink-0">{lastWorkTime}</span>
        )}
      </button>
    )
  }

  return (
    <button
      data-testid={`dashboard-card-${node.id}`}
      onClick={handleClick}
      className={cn(
        'relative w-full text-left rounded-node border border-border bg-surface',
        'p-lg flex flex-col gap-sm',
        'hover:shadow-elevation-1 transition-shadow duration-150',
        'overflow-hidden'
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-node', typeColorBarMap[node.type] ?? 'bg-gray-400')} />
      <div className="flex items-center gap-sm">
        <NodeTypeIcon type={node.type} size={16} />
        <span className="text-node-title-lg text-text-primary truncate flex-1">{node.title}</span>
        <StatusBadge status={node.status} />
      </div>
      <div className="flex items-center gap-lg text-caption text-text-tertiary">
        {node.sessionCount > 0 && <span>세션 {node.sessionCount}개</span>}
        {node.decisionCount > 0 && <span>결정 {node.decisionCount}개</span>}
        {node.fileChangeCount > 0 && <span>파일 변경 {node.fileChangeCount}개</span>}
      </div>
      {lastWorkTime && (
        <span className="text-caption text-text-tertiary">
          마지막 작업: {lastWorkTime}
        </span>
      )}
    </button>
  )
}
