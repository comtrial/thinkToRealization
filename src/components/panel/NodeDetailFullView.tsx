'use client'

import { useUIStore } from '@/stores/ui-store'
import { useNodeStore } from '@/stores/node-store'
import { NodeDetailPanel, NodeProperties } from './NodeDetailPanel'
import { SessionLogViewer } from './SessionLogViewer'
import { PlanTab } from './PlanTab'
import { X, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SessionResponse } from '@/lib/types/api'

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
          className="p-3 rounded-node border border-border hover:bg-surface-hover transition-colors"
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

export function NodeDetailFullView() {
  const panelNodeId = useUIStore((s) => s.panelNodeId)
  const closePanel = useUIStore((s) => s.closePanel)
  const toggleFullPage = useUIStore((s) => s.toggleFullPage)
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const sessions = useNodeStore((s) => s.sessions)
  const isLoading = useNodeStore((s) => s.isLoading)
  const selectNode = useNodeStore((s) => s.selectNode)

  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (panelNodeId) {
      selectNode(panelNodeId)
      setViewingSessionId(null)
    }
  }, [panelNodeId, selectNode])

  if (!panelNodeId) return null

  return (
    <div className="h-full flex flex-col bg-surface" data-testid="side-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            data-testid="panel-close-btn"
            onClick={closePanel}
            className="p-1 rounded-button hover:bg-surface-hover text-text-secondary"
            title="닫기 (ESC)"
          >
            <X size={16} />
          </button>
          {selectedNode && (
            <span className="text-caption text-text-tertiary truncate">
              {selectedNode.projectId}
              {' > '}
              <span className="text-text-secondary">{selectedNode.title}</span>
            </span>
          )}
        </div>
        <button
          data-testid="panel-fullscreen-btn"
          onClick={toggleFullPage}
          className="p-1 rounded-button hover:bg-surface-hover text-text-secondary"
          title="축소"
        >
          <Minimize2 size={16} />
        </button>
      </div>

      {/* Content: 2-column layout */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-caption text-text-tertiary">로딩 중...</span>
        </div>
      ) : selectedNode ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Main content — left column */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[780px] mx-auto">
              <NodeDetailPanel />
              {/* Sessions */}
              <div className="px-8 pb-8">
                <label className="text-caption text-text-tertiary mb-2 block">
                  세션 ({sessions.length})
                </label>
                <SessionsSection
                  sessions={sessions}
                  viewingSessionId={viewingSessionId}
                  setViewingSessionId={setViewingSessionId}
                />
              </div>
              {/* Plans */}
              <div className="px-8 pb-8">
                <PlanTab />
              </div>
            </div>
          </div>
          {/* Properties sidebar — right column */}
          <div className="w-[260px] border-l border-border/30 overflow-y-auto shrink-0">
            <div className="p-5">
              <span className="text-caption text-text-tertiary font-medium block mb-4">Properties</span>
              <NodeProperties />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
