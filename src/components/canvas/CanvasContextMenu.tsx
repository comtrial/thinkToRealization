'use client'

import { type MutableRefObject, useState, useRef, useCallback, useEffect } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Lightbulb, Code2, Bug } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import type { NodeType } from '@/lib/types/api'

interface CanvasContextMenuProps {
  children: React.ReactNode
  onCreateNode: (type: NodeType, position: { x: number; y: number }) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
  contextPositionRef: MutableRefObject<{ x: number; y: number }>
}

const nodeTypeOptions: { type: NodeType; label: string; icon: React.ReactNode }[] = [
  { type: 'planning', label: '새 기획', icon: <Lightbulb size={14} /> },
  { type: 'feature', label: '새 기능개발', icon: <Code2 size={14} /> },
  { type: 'issue', label: '새 이슈', icon: <Bug size={14} /> },
]

export { nodeTypeOptions }

function MobileContextMenu({
  children,
  onCreateNode,
  screenToFlowPosition,
  contextPositionRef,
}: CanvasContextMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef({ x: 0, y: 0 })

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      cancelTimer()
      timerRef.current = setTimeout(() => {
        contextPositionRef.current = { x: touch.clientX, y: touch.clientY }
        setMenuPos({ x: touch.clientX, y: touch.clientY })
        setMenuOpen(true)
      }, 500)
    },
    [cancelTimer, contextPositionRef]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        cancelTimer()
      }
    },
    [cancelTimer]
  )

  const handleTouchEnd = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  // Close menu on outside tap
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    // Delay to prevent immediate close from the same touch
    const id = setTimeout(() => {
      document.addEventListener('touchstart', handler, { once: true })
    }, 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      {menuOpen && (
        <div
          className="fixed z-50 min-w-[200px] bg-surface rounded-dropdown border border-border shadow-elevation-2 py-1"
          style={{
            left: Math.min(menuPos.x, window.innerWidth - 210),
            top: Math.min(menuPos.y, window.innerHeight - 300),
          }}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {nodeTypeOptions.map(({ type, label, icon }) => (
            <button
              key={type}
              className="flex items-center gap-2 w-full px-3 py-3 text-body text-text-primary hover:bg-surface-hover active:bg-surface-hover cursor-pointer outline-none"
              onClick={() => {
                try {
                  const screenPos = contextPositionRef.current
                  const flowPos = screenToFlowPosition(screenPos)
                  onCreateNode(type, flowPos)
                } catch (err) {
                  console.error('Failed to create node from context menu:', err)
                }
                setMenuOpen(false)
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DesktopContextMenu({
  children,
  onCreateNode,
  screenToFlowPosition,
  contextPositionRef,
}: CanvasContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[180px] bg-surface rounded-dropdown border border-border shadow-elevation-2 py-1 z-50 animate-in fade-in-0 zoom-in-95"
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

export function CanvasContextMenu(props: CanvasContextMenuProps) {
  const isMobile = useMobile()

  if (isMobile) {
    return <MobileContextMenu {...props} />
  }

  return <DesktopContextMenu {...props} />
}
