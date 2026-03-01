'use client'

import { useState } from 'react'
import { Star, ArrowUpRight, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNodeStore } from '@/stores/node-store'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { DecisionResponse } from '@/lib/types/api'
import { PromoteDialog } from './PromoteDialog'

interface DecisionItemProps {
  decision: DecisionResponse
  onDelete: (id: string) => void
  onPromote: (decision: DecisionResponse) => void
}

function DecisionItem({ decision, onDelete, onPromote }: DecisionItemProps) {
  const timeAgo = formatDistanceToNow(new Date(decision.createdAt), {
    addSuffix: true,
    locale: ko,
  })

  return (
    <div className="group relative rounded-node border border-border bg-surface p-3 hover:shadow-elevation-1 transition-shadow">
      <div className="flex items-start gap-2">
        <Star size={14} className="text-accent mt-0.5 flex-shrink-0" fill="#4F46E5" />
        <div className="flex-1 min-w-0">
          <p className="text-body text-text-primary whitespace-pre-wrap break-words">
            {decision.content}
          </p>
          <p className="text-caption text-text-tertiary mt-1">{timeAgo}</p>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onPromote(decision)}
          className="p-1 rounded-button hover:bg-accent-light text-text-tertiary hover:text-accent transition-colors"
          title="노드로 승격"
        >
          <ArrowUpRight size={14} />
        </button>
        <button
          onClick={() => onDelete(decision.id)}
          className="p-1 rounded-button hover:bg-red-50 text-text-tertiary hover:text-error transition-colors"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export function DecisionList() {
  const { selectedNode, decisions, addDecision, removeDecision } = useNodeStore()
  const [newContent, setNewContent] = useState('')
  const [promoteTarget, setPromoteTarget] = useState<DecisionResponse | null>(null)

  if (!selectedNode) return null

  const handleAdd = async () => {
    const trimmed = newContent.trim()
    if (!trimmed) return
    await addDecision(selectedNode.id, trimmed)
    setNewContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <h3 className="text-node-title-lg text-text-primary flex items-center gap-2">
        결정사항
        {decisions.length > 0 && (
          <span className="text-caption text-text-tertiary">({decisions.length})</span>
        )}
      </h3>

      {decisions.length === 0 ? (
        <p className="text-caption text-text-tertiary py-2">
          아직 결정사항이 없습니다
        </p>
      ) : (
        <div className="flex flex-col gap-xs">
          {decisions.map((d) => (
            <DecisionItem
              key={d.id}
              decision={d}
              onDelete={removeDecision}
              onPromote={setPromoteTarget}
            />
          ))}
        </div>
      )}

      {/* Add new decision input */}
      <div className="flex gap-sm mt-xs">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="새 결정사항 추가..."
          className={cn(
            'flex-1 px-3 py-1.5 rounded-button text-body',
            'bg-surface-hover border border-border',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20',
            'placeholder:text-text-tertiary',
            'transition-colors'
          )}
        />
        <button
          onClick={handleAdd}
          disabled={!newContent.trim()}
          className={cn(
            'p-1.5 rounded-button border border-border',
            'hover:bg-surface-hover transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Plus size={16} className="text-text-secondary" />
        </button>
      </div>

      {/* Promote dialog */}
      {promoteTarget && (
        <PromoteDialog
          decision={promoteTarget}
          onClose={() => setPromoteTarget(null)}
        />
      )}
    </div>
  )
}
