'use client'

import { cn } from '@/lib/utils'
import type { NodeStatus } from '@/lib/types/api'

const statusConfig: Record<NodeStatus, { label: string; className: string }> = {
  backlog: { label: 'Backlog', className: 'bg-status-backlog/20 text-status-backlog' },
  todo: { label: 'Todo', className: 'bg-status-todo/20 text-[#92700C]' },
  in_progress: { label: 'In Progress', className: 'bg-status-progress/20 text-status-progress' },
  done: { label: 'Done', className: 'bg-status-done/20 text-[#15803D]' },
  archived: { label: 'Archived', className: 'bg-status-archived/20 text-status-archived' },
}

export function StatusBadge({ status }: { status: NodeStatus }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-badge text-badge', config.className)}>
      {config.label}
    </span>
  )
}

const statusColorMap: Record<NodeStatus, string> = {
  backlog: 'bg-status-backlog',
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  done: 'bg-status-done',
  archived: 'bg-status-archived',
}

export function StatusDot({ status }: { status: NodeStatus }) {
  return <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColorMap[status])} />
}

export function StatusCircleIcon({ status, size = 16 }: { status: NodeStatus; size?: number }) {
  return (
    <div
      className={cn('rounded-full flex-shrink-0', statusColorMap[status])}
      style={{ width: size, height: size }}
    />
  )
}

const typeColorMap: Record<string, string> = {
  planning: 'bg-type-idea',
  feature: 'bg-type-task',
  issue: 'bg-type-issue',
}

export function TypeColorBar({ type }: { type: string }) {
  return (
    <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-node', typeColorMap[type] ?? 'bg-gray-400')} />
  )
}

export function PriorityIcon({ priority, size = 16 }: { priority: string; size?: number }) {
  const colorMap: Record<string, string> = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-yellow-500',
    low: 'text-blue-400',
    none: 'text-text-tertiary',
  }
  const color = colorMap[priority] || colorMap.none
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={cn('flex-shrink-0', color)} fill="currentColor">
      <rect x="3" y="10" width="2" height="4" rx="0.5" opacity={priority === 'none' ? 0.3 : 1} />
      <rect x="7" y="6" width="2" height="8" rx="0.5" opacity={['medium', 'high', 'critical'].includes(priority) ? 1 : 0.3} />
      <rect x="11" y="2" width="2" height="12" rx="0.5" opacity={['high', 'critical'].includes(priority) ? 1 : 0.3} />
    </svg>
  )
}

export { typeColorMap }
