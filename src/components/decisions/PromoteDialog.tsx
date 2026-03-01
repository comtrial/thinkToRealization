'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { useNodeStore } from '@/stores/node-store'
import type { DecisionResponse, NodeType } from '@/lib/types/api'

const nodeTypeOptions: { type: NodeType; label: string }[] = [
  { type: 'idea', label: '아이디어' },
  { type: 'task', label: '작업' },
  { type: 'decision', label: '결정' },
  { type: 'issue', label: '이슈' },
  { type: 'milestone', label: '마일스톤' },
  { type: 'note', label: '메모' },
]

interface PromoteDialogProps {
  decision: DecisionResponse
  onClose: () => void
}

export function PromoteDialog({ decision, onClose }: PromoteDialogProps) {
  const [selectedType, setSelectedType] = useState<NodeType>('task')
  const [title, setTitle] = useState(
    decision.content.length > 60
      ? decision.content.slice(0, 60) + '...'
      : decision.content
  )
  const promoteDecision = useNodeStore((s) => s.promoteDecision)

  const handlePromote = async () => {
    if (!title.trim()) return
    await promoteDecision(decision.id, selectedType, title.trim())
    onClose()
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-surface-overlay z-40" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[420px] max-w-[90vw] bg-surface rounded-palette border border-border shadow-elevation-3',
            'p-xl z-50 focus:outline-none'
          )}
        >
          <div className="flex items-center justify-between mb-lg">
            <Dialog.Title className="text-section-header text-text-primary">
              노드로 승격
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-button hover:bg-surface-hover transition-colors">
                <X size={16} className="text-text-tertiary" />
              </button>
            </Dialog.Close>
          </div>

          {/* Node type selector */}
          <div className="mb-lg">
            <label className="text-caption text-text-secondary block mb-sm">노드 타입</label>
            <div className="flex gap-xs flex-wrap">
              {nodeTypeOptions.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-button text-badge border transition-colors',
                    selectedType === type
                      ? 'border-accent bg-accent-light text-accent'
                      : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                  )}
                >
                  <NodeTypeIcon type={type} size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title input */}
          <div className="mb-xl">
            <label className="text-caption text-text-secondary block mb-sm">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-button text-body',
                'border border-border bg-surface',
                'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20',
                'transition-colors'
              )}
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-sm">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-button text-body text-text-secondary border border-border hover:bg-surface-hover transition-colors"
            >
              취소
            </button>
            <button
              onClick={handlePromote}
              disabled={!title.trim()}
              className={cn(
                'px-4 py-2 rounded-button text-body text-text-on-accent',
                'bg-accent hover:bg-accent-hover transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              승격
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
