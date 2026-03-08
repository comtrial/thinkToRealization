'use client'

import { useUIStore } from '@/stores/ui-store'
import { useNodeStore } from '@/stores/node-store'
import { NodeDetailPanel, NodeProperties } from './NodeDetailPanel'
import { SessionLogViewer } from './SessionLogViewer'
import { PlanTab } from './PlanTab'
import { X } from 'lucide-react'
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
    <div className="h-full flex flex-col bg-surface relative" data-testid="side-panel">
      {/* Close button — floating top-left */}
      <button
        data-testid="panel-close-btn"
        onClick={closePanel}
        className="absolute top-3 left-4 z-10 p-1.5 rounded-button hover:bg-surface-hover text-text-secondary transition-colors"
        title="닫기 (ESC)"
      >
        <X size={16} />
      </button>

      {/* Content: 2-column layout (main + properties sidebar) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-caption text-text-tertiary">로딩 중...</span>
        </div>
      ) : selectedNode ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: main content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[780px] mx-auto">
              <NodeDetailPanel showProperties={false} />
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
          {/* Right: properties sidebar (Linear-style) */}
          <div className="w-[260px] border-l border-border/30 overflow-y-auto shrink-0">
            <div className="p-5">
              <span className="text-caption text-text-tertiary font-medium block mb-4">Properties</span>
              <NodeProperties vertical />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
