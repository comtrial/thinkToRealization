'use client'

import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusCircleIcon } from '@/components/shared/Badge'
import { IssueRow } from './IssueRow'
import type { NodeResponse, NodeStatus } from '@/lib/types/api'

interface IssueListSectionProps {
  status: NodeStatus
  label: string
  nodes: NodeResponse[]
  defaultOpen?: boolean
  onAddNode?: () => void
}

export function IssueListSection({
  status,
  label,
  nodes,
  defaultOpen = true,
  onAddNode,
}: IssueListSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen)

  return (
    <div>
      {/* Section header */}
      <div
        className="w-full flex items-center gap-2 px-4 py-1.5
                   text-caption font-medium text-text-secondary
                   hover:bg-surface-hover transition-colors
                   sticky top-0 bg-background/90 backdrop-blur-sm z-10
                   border-b border-border cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRight
          size={14}
          className={cn(
            'text-text-tertiary transition-transform duration-150',
            !collapsed && 'rotate-90'
          )}
        />

        <StatusCircleIcon status={status} size={14} />

        <span>{label}</span>

        <span className="text-text-tertiary">{nodes.length}</span>

        <div className="flex-1" />

        {onAddNode && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddNode() }}
            className="p-1 rounded-button hover:bg-surface-active text-text-tertiary
                       hover:text-text-secondary transition-colors"
            title="새 항목 추가"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Rows */}
      {!collapsed && nodes.length > 0 && (
        <div className="flex flex-col">
          {nodes.map((node) => (
            <IssueRow key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}
