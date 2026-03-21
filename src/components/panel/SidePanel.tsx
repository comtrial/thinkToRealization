'use client'

import { useUIStore } from '@/stores/ui-store'
import { PanelTabs } from './PanelTabs'
import { NodeDetailPanel } from './NodeDetailPanel'
import { SessionLogViewer } from './SessionLogViewer'
import { PlanTab } from './PlanTab'
import { useNodeStore } from '@/stores/node-store'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useMobile } from '@/hooks/useMobile'
import type { SessionResponse } from '@/lib/types/api'
// ESC key handling is centralized in useKeyboardShortcuts

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useIsLocal() {
  const [isLocal, setIsLocal] = useState(false)
  useEffect(() => {
    const host = window.location.hostname
    setIsLocal(host === 'localhost' || host === '127.0.0.1')
  }, [])
  return isLocal
}

function SessionsSection({
  sessions,
  viewingSessionId,
  setViewingSessionId,
}: {
  sessions: SessionResponse[]
  viewingSessionId: string | null
  setViewingSessionId: (id: string | null) => void
}) {
  if (viewingSessionId) {
    return (
      <div>
        <button
          onClick={() => setViewingSessionId(null)}
          className="text-caption text-accent hover:underline mb-3"
        >
          &larr; 세션 목록으로
        </button>
        <SessionLogViewer sessionId={viewingSessionId} />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <p className="text-caption text-text-tertiary">
        아직 세션이 없습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="p-3 rounded-node border border-border hover:bg-surface-hover hover:shadow-elevation-1 transition-all"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-node-title-sm text-text-primary">
              {session.title || '제목 없는 세션'}
            </span>
            <span
              className={[
                'text-badge px-1.5 py-0.5 rounded-badge',
                session.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : session.status === 'paused'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {session.status === 'active'
                ? '진행 중'
                : session.status === 'paused'
                ? '일시정지'
                : '완료'}
            </span>
          </div>
          <div className="text-caption text-text-tertiary mb-2">
            {new Date(session.startedAt).toLocaleDateString('ko-KR')}
            {session.endedAt && ` - ${new Date(session.endedAt).toLocaleDateString('ko-KR')}`}
          </div>
          <button
            onClick={() => setViewingSessionId(session.id)}
            className="text-caption text-accent hover:underline"
          >
            로그 보기
          </button>
        </div>
      ))}
    </div>
  )
}

export function SidePanel() {
  const panelMode = useUIStore((s) => s.panelMode)
  const panelNodeId = useUIStore((s) => s.panelNodeId)
  const panelTab = useUIStore((s) => s.panelTab)
  const closePanel = useUIStore((s) => s.closePanel)
  const panelWidth = useUIStore((s) => s.panelWidth)
  const setPanelWidth = useUIStore((s) => s.setPanelWidth)
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const sessions = useNodeStore((s) => s.sessions)
  const isLoading = useNodeStore((s) => s.isLoading)
  const selectNode = useNodeStore((s) => s.selectNode)

  const isMobile = useMobile()
  const isLocal = useIsLocal()
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)

  // Drag resize logic
  const isDragging = useRef(false)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const windowWidth = window.innerWidth
      const newWidth = ((windowWidth - ev.clientX) / windowWidth) * 100
      const clamped = Math.min(80, Math.max(20, newWidth))
      setPanelWidth(clamped)
    }

    const handleUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [setPanelWidth])

  // Load node data when panel opens
  useEffect(() => {
    if (panelNodeId && panelMode !== 'closed') {
      selectNode(panelNodeId)
      setViewingSessionId(null)
    }
  }, [panelNodeId, panelMode, selectNode])

  // Full mode on desktop is handled by NodeDetailFullView in page.tsx
  if (panelMode === 'closed') return null
  if (panelMode === 'full' && !isMobile) return null

  // Mobile full mode: true fullscreen overlay covering entire screen (including header)
  if (isMobile && panelMode === 'full') {
    return (
      <aside
        data-testid="side-panel"
        className="fixed inset-0 z-50 bg-surface flex flex-col transition-all duration-200 ease-devflow"
      >
        {/* Full content — close button is inside NodeDetailPanel title row */}
        <div className="flex-1 overflow-y-auto pb-safe">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-caption text-text-tertiary">로딩 중...</span>
            </div>
          ) : selectedNode ? (
            <NodeDetailPanel onClose={closePanel} />
          ) : null}
        </div>
      </aside>
    )
  }

  // Mobile peek mode: Notion-style, full screen below header
  if (isMobile) {
    return (
      <>
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-surface-overlay z-40"
          style={{ top: 'var(--header-height)' }}
          onClick={closePanel}
        />

        {/* Panel — fixed, full width, below header */}
        <aside
          data-testid="side-panel"
          className="fixed left-0 right-0 bottom-0 bg-surface z-50 flex flex-col transition-all duration-200 ease-devflow"
          style={{ top: 'var(--header-height)' }}
        >
          {/* Content — no header bar, no tabs, Notion-style direct content */}
          <div className="flex-1 overflow-y-auto pb-safe">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-caption text-text-tertiary">로딩 중...</span>
              </div>
            ) : selectedNode ? (
              <NodeDetailPanel onClose={closePanel} />
            ) : null}
          </div>
        </aside>
      </>
    )
  }

  // Desktop: Peek mode — no header bar, just tabs + content
  return (
    <aside
      data-testid="side-panel"
      className="absolute top-0 right-0 h-full bg-surface border-l border-border z-30 flex flex-col"
      style={{ width: `${panelWidth}%`, minWidth: '320px', maxWidth: '80%' }}
    >
      {/* Drag resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors z-10"
      />

      {/* Tabs */}
      <PanelTabs />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-caption text-text-tertiary">로딩 중...</span>
          </div>
        )}
        {!isLoading && selectedNode && panelTab === 'detail' && (
          <NodeDetailPanel />
        )}
        {!isLoading && selectedNode && isLocal && panelTab === 'sessions' && (
          <div className="p-4 flex flex-col gap-3">
            <SessionsSection
              sessions={sessions}
              viewingSessionId={viewingSessionId}
              setViewingSessionId={setViewingSessionId}
            />
          </div>
        )}
        {!isLoading && selectedNode && isLocal && panelTab === 'plans' && <PlanTab />}
      </div>
    </aside>
  )
}
