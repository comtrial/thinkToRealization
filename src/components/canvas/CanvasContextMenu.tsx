'use client'

import { type MutableRefObject } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Lightbulb, Wrench, Zap, Bug, Flag, StickyNote } from 'lucide-react'
import type { NodeType } from '@/lib/types/api'

interface CanvasContextMenuProps {
  children: React.ReactNode
  onCreateNode: (type: NodeType, position: { x: number; y: number }) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
  contextPositionRef: MutableRefObject<{ x: number; y: number }>
}

const nodeTypeOptions: { type: NodeType; label: string; icon: React.ReactNode }[] = [
  { type: 'idea', label: '새 아이디어', icon: <Lightbulb size={14} /> },
  { type: 'task', label: '새 작업', icon: <Wrench size={14} /> },
  { type: 'decision', label: '새 결정', icon: <Zap size={14} /> },
  { type: 'issue', label: '새 이슈', icon: <Bug size={14} /> },
  { type: 'milestone', label: '새 마일스톤', icon: <Flag size={14} /> },
  { type: 'note', label: '새 메모', icon: <StickyNote size={14} /> },
]

export function CanvasContextMenu({ children, onCreateNode, screenToFlowPosition, contextPositionRef }: CanvasContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[180px] bg-surface rounded-dropdown border border-border shadow-elevation-2 py-1 z-50"
          onContextMenu={(e) => e.preventDefault()}
        >
          {nodeTypeOptions.map(({ type, label, icon }) => (
            <ContextMenu.Item
              key={type}
              className="flex items-center gap-2 px-3 py-1.5 text-body text-text-primary hover:bg-surface-hover cursor-pointer outline-none"
              onSelect={() => {
                try {
                  const screenPos = contextPositionRef.current
                  const flowPos = screenToFlowPosition(screenPos)
                  onCreateNode(type, flowPos)
                } catch (err) {
                  console.error('Failed to create node from context menu:', err)
                }
              }}
            >
              {icon}
              <span>{label}</span>
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
