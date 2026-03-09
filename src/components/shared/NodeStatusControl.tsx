'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNodeStore } from '@/stores/node-store'
import { useToast } from '@/components/shared/Toast'
import type { NodeStatus } from '@/lib/types/api'

const statusOptions: { status: NodeStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'bg-status-backlog' },
  { status: 'todo', label: 'Todo', color: 'bg-status-todo' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-status-progress' },
  { status: 'done', label: 'Done', color: 'bg-status-done' },
  { status: 'archived', label: 'Archived', color: 'bg-status-archived' },
]

export function NodeStatusControl() {
  const { selectedNode, updateNodeStatus } = useNodeStore()
  const { addToast } = useToast()

  if (!selectedNode) return null

  const currentStatus = statusOptions.find((s) => s.status === selectedNode.status)

  const handleSelect = async (status: NodeStatus) => {
    if (status === selectedNode.status) return
    const result = await updateNodeStatus(selectedNode.id, status)
    if (!result.ok) {
      addToast('error', result.error || '상태 변경 실패')
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-button',
            'border border-border text-badge text-text-primary',
            'hover:bg-surface-hover transition-colors',
            'focus:outline-none focus:border-accent'
          )}
        >
          <div className={cn('w-2 h-2 rounded-full', currentStatus?.color)} />
          <span>{currentStatus?.label}</span>
          <ChevronDown size={12} className="text-text-tertiary" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-surface rounded-dropdown border border-border shadow-elevation-2 py-1 z-50"
          sideOffset={4}
          align="start"
        >
          {statusOptions.map(({ status, label, color }) => (
            <DropdownMenu.Item
              key={status}
              disabled={selectedNode.status === status}
              onSelect={() => handleSelect(status)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-body text-text-primary',
                'hover:bg-surface-hover cursor-pointer outline-none',
                selectedNode.status === status && 'opacity-50 cursor-default'
              )}
            >
              <div className={cn('w-2 h-2 rounded-full', color)} />
              <span className="flex-1">{label}</span>
              {selectedNode.status === status && (
                <Check size={14} className="text-accent" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
