'use client'

import { Filter, SlidersHorizontal, Plus } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'

interface DashboardToolbarProps {
  projectTitle?: string
  onCreateNode?: () => void
}

export function DashboardToolbar({ projectTitle, onCreateNode }: DashboardToolbarProps) {
  const isMobile = useMobile()

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface flex-shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-section-header text-text-primary">
          {projectTitle || '모든 항목'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {onCreateNode && (
          <button
            onClick={onCreateNode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-caption text-text-secondary hover:bg-surface-hover rounded-button transition-colors"
          >
            <Plus size={14} />
            <span>새 항목</span>
          </button>
        )}
        <button className="flex items-center gap-1.5 px-2.5 py-1 text-caption text-text-secondary
                           rounded-button border border-border hover:bg-surface-hover transition-colors">
          <Filter size={14} />
          {!isMobile && <span>필터</span>}
        </button>
        <button className="flex items-center gap-1.5 px-2.5 py-1 text-caption text-text-secondary
                           rounded-button border border-border hover:bg-surface-hover transition-colors">
          <SlidersHorizontal size={14} />
          {!isMobile && <span>표시</span>}
        </button>
      </div>
    </div>
  )
}
