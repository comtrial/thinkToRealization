'use client'

import { useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AppShell } from '@/components/layout/AppShell'
import { useUIStore } from '@/stores/ui-store'
import { useSessionStore } from '@/stores/session-store'
import { useProject } from '@/components/providers/ProjectProvider'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { CommandPalette } from '@/components/command/CommandPalette'
import { EmptyState } from '@/components/shared/EmptyState'
import { SessionEndPrompt } from '@/components/terminal/SessionEndPrompt'
import { SessionControls } from '@/components/terminal/SessionControls'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const CanvasView = dynamic(
  () => import('@/components/canvas/CanvasView').then(m => ({ default: m.CanvasView })),
  { ssr: false }
)

const TerminalPanel = dynamic(
  () => import('@/components/terminal/TerminalPanel').then(m => ({ default: m.TerminalPanel })),
  { ssr: false }
)

function TerminalSection() {
  const terminalExpanded = useUIStore((s) => s.terminalExpanded)
  const terminalHeight = useUIStore((s) => s.terminalHeight)
  const setTerminalExpanded = useUIStore((s) => s.setTerminalExpanded)
  const setTerminalHeight = useUIStore((s) => s.setTerminalHeight)
  const activeSession = useSessionStore((s) => s.activeSession)
  const sessionEndPromptVisible = useSessionStore((s) => s.sessionEndPromptVisible)
  const panelNodeId = useUIStore((s) => s.panelNodeId)

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startHeight: terminalHeight }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startY - ev.clientY
        const newHeight = Math.max(150, Math.min(600, dragRef.current.startHeight + delta))
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
    [terminalHeight, setTerminalHeight]
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
          className="text-caption text-text-secondary hover:text-text-primary transition-colors"
        >
          {terminalExpanded ? '\u25BC' : '\u25B2'} Terminal
        </button>
        <SessionControls nodeId={nodeId} />
      </div>

      {terminalExpanded && (
        <>
          {/* Drag handle */}
          <div
            className="h-1 cursor-row-resize bg-border-hover hover:bg-accent shrink-0"
            onMouseDown={handleDragStart}
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
  const { currentProject } = useProject()

  if (!currentProject) {
    return <EmptyState variant="no-project" className="h-full" />
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
