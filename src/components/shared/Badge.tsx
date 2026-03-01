'use client'

import { cn } from '@/lib/utils'
import type { NodeStatus, NodeType } from '@/lib/types/api'

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

export function StatusDot({ status }: { status: NodeStatus }) {
  const colorMap: Record<NodeStatus, string> = {
    backlog: 'bg-status-backlog',
    todo: 'bg-status-todo',
    in_progress: 'bg-status-progress',
    done: 'bg-status-done',
    archived: 'bg-status-archived',
  }
  return <div className={cn('w-2 h-2 rounded-full flex-shrink-0', colorMap[status])} />
}

const typeColorMap: Record<NodeType, string> = {
  idea: 'bg-type-idea',
  decision: 'bg-type-decision',
  task: 'bg-type-task',
  issue: 'bg-type-issue',
  milestone: 'bg-type-milestone',
  note: 'bg-type-note',
}

export function TypeColorBar({ type }: { type: NodeType }) {
  return (
    <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-node', typeColorMap[type])} />
  )
}

export { typeColorMap }
