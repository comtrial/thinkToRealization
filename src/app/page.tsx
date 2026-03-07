'use client'

import { useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AppShell } from '@/components/layout/AppShell'
import { useUIStore } from '@/stores/ui-store'
import { useSessionStore } from '@/stores/session-store'
import { useProject } from '@/components/providers/ProjectProvider'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { NodeDetailFullView } from '@/components/panel/NodeDetailFullView'
import { CommandPalette } from '@/components/command/CommandPalette'
import { EmptyState } from '@/components/shared/EmptyState'
import { SessionEndPrompt } from '@/components/terminal/SessionEndPrompt'
import { SessionControls } from '@/components/terminal/SessionControls'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMobile } from '@/hooks/useMobile'

const CanvasView = dynamic(
  () => import('@/components/canvas/CanvasView').then(m => ({ default: m.CanvasView })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-caption text-text-secondary animate-pulse">캔버스 로딩 중...</div>
      </div>
    ),
  }
)

const TerminalPanel = dynamic(
  () => import('@/components/terminal/TerminalPanel').then(m => ({ default: m.TerminalPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-terminal-bg">
        <div className="text-caption text-terminal-text animate-pulse">터미널 로딩 중...</div>
      </div>
    ),
  }
)

function TerminalSection() {
  const terminalExpanded = useUIStore((s) => s.terminalExpanded)
  const terminalHeight = useUIStore((s) => s.terminalHeight)
  const setTerminalExpanded = useUIStore((s) => s.setTerminalExpanded)
  const setTerminalHeight = useUIStore((s) => s.setTerminalHeight)
  const activeSession = useSessionStore((s) => s.activeSession)
  const sessionEndPromptVisible = useSessionStore((s) => s.sessionEndPromptVisible)
  const panelNodeId = useUIStore((s) => s.panelNodeId)
  const isMobile = useMobile()

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  // Mouse drag handler (desktop)
  const handleMouseDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startHeight: terminalHeight }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startY - ev.clientY
        const maxH = isMobile ? 400 : 600
        const newHeight = Math.max(150, Math.min(maxH, dragRef.current.startHeight + delta))
        setTerminalHeight(newHeight)
      }

      const handleMouseUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [terminalHeight, setTerminalHeight, isMobile]
  )

  // Touch drag handler (mobile)
  const handleTouchDragStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      dragRef.current = { startY: touch.clientY, startHeight: terminalHeight }

      const handleTouchMove = (ev: TouchEvent) => {
        if (!dragRef.current) return
        ev.preventDefault()
        const t = ev.touches[0]
        const delta = dragRef.current.startY - t.clientY
        const maxH = isMobile ? 400 : 600
        const newHeight = Math.max(150, Math.min(maxH, dragRef.current.startHeight + delta))
        setTerminalHeight(newHeight)
      }

      const handleTouchEnd = () => {
        dragRef.current = null
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }

      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    },
    [terminalHeight, setTerminalHeight, isMobile]
  )

  const nodeId = activeSession?.nodeId || panelNodeId

  if (!nodeId) return null

  return (
    <div
      className={[
        'border-t border-border flex flex-col',
        'transition-all duration-terminal ease-devflow',
        !terminalExpanded ? 'h-10' : '',
      ].join(' ')}
      style={terminalExpanded ? { height: `${terminalHeight}px` } : undefined}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 h-10 shrink-0 bg-surface border-b border-border">
        <button
          onClick={() => setTerminalExpanded(!terminalExpanded)}
          className="text-caption text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
        >
          {terminalExpanded ? '\u25BC' : '\u25B2'} Terminal
        </button>
        <SessionControls nodeId={nodeId} />
      </div>

      {terminalExpanded && (
        <>
          {/* Drag handle — touch-friendly on mobile */}
          <div
            className={`${isMobile ? 'h-3' : 'h-1'} cursor-row-resize bg-border-hover hover:bg-accent active:bg-accent shrink-0`}
            onMouseDown={handleMouseDragStart}
            onTouchStart={handleTouchDragStart}
          />

          {/* Terminal */}
          <div className="flex-1 overflow-hidden">
            <TerminalPanel nodeId={activeSession ? nodeId : null} />
          </div>

          {/* Session end prompt */}
          {sessionEndPromptVisible && <SessionEndPrompt />}
        </>
      )}
    </div>
  )
}

function MainContent() {
  const activeTab = useUIStore((s) => s.activeTab)
  const panelMode = useUIStore((s) => s.panelMode)
  const { currentProject } = useProject()

  if (!currentProject) {
    return <EmptyState variant="no-project" className="h-full" />
  }

  // Full mode: node detail replaces the main content area (like a tab switch)
  if (panelMode === 'full') {
    return <NodeDetailFullView />
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' ? (
          <DashboardView projectId={currentProject.id} />
        ) : (
          <CanvasView projectId={currentProject.id} />
        )}
      </div>
      <TerminalSection />
    </div>
  )
}

export default function Home() {
  useKeyboardShortcuts()

  return (
    <AppShell>
      <MainContent />
      <CommandPalette />
    </AppShell>
  )
}
