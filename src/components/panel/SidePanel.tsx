'use client'

import { useUIStore } from '@/stores/ui-store'
import { PanelTabs } from './PanelTabs'
import { NodeDetailPanel } from './NodeDetailPanel'
import { SessionLogViewer } from './SessionLogViewer'
import { PlanTab } from './PlanTab'
import { useNodeStore } from '@/stores/node-store'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMobile } from '@/hooks/useMobile'
// ESC key handling is centralized in useKeyboardShortcuts

export function SidePanel() {
  const panelMode = useUIStore((s) => s.panelMode)
  const panelNodeId = useUIStore((s) => s.panelNodeId)
  const panelTab = useUIStore((s) => s.panelTab)
  const closePanel = useUIStore((s) => s.closePanel)
  const toggleFullPage = useUIStore((s) => s.toggleFullPage)
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const sessions = useNodeStore((s) => s.sessions)
  const isLoading = useNodeStore((s) => s.isLoading)
  const selectNode = useNodeStore((s) => s.selectNode)

  const isMobile = useMobile()
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)

  // Load node data when panel opens
  useEffect(() => {
    if (panelNodeId && panelMode !== 'closed') {
      selectNode(panelNodeId)
      setViewingSessionId(null)
    }
  }, [panelNodeId, panelMode, selectNode])

  if (panelMode === 'closed') return null

  // On mobile, both peek and full modes use fixed positioning to cover the full screen
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
          className="fixed left-0 right-0 bottom-0 bg-surface z-50 flex flex-col"
          style={{ top: 'var(--header-height)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                data-testid="panel-close-btn"
                onClick={closePanel}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover text-text-secondary"
                title="닫기 (ESC)"
              >
                <X size={16} />
              </button>
              {selectedNode && (
                <h2 className="text-node-title-lg text-text-primary truncate">
                  {selectedNode.title}
                </h2>
              )}
            </div>
            <button
              data-testid="panel-fullscreen-btn"
              onClick={closePanel}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover text-text-secondary"
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <PanelTabs />

          {/* Content */}
          <div className="flex-1 overflow-y-auto pb-safe">
            {panelTab === 'overview' && isLoading && (
              <div className="flex items-center justify-center py-12">
                <span className="text-caption text-text-tertiary">로딩 중...</span>
              </div>
            )}
            {panelTab === 'overview' && !isLoading && selectedNode && (
              <NodeDetailPanel />
            )}
            {panelTab === 'sessions' && (
              <div className="p-4 flex flex-col gap-3">
                {viewingSessionId ? (
                  <div>
                    <button
                      onClick={() => setViewingSessionId(null)}
                      className="text-caption text-accent hover:underline mb-3 min-h-[44px]"
                    >
                      &larr; 세션 목록으로
                    </button>
                    <SessionLogViewer sessionId={viewingSessionId} />
                  </div>
                ) : (
                  <>
                    {sessions.length === 0 ? (
                      <p className="text-caption text-text-tertiary">
                        아직 세션이 없습니다.
                      </p>
                    ) : (
                      sessions.map((session) => (
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
                            className="text-caption text-accent hover:underline min-h-[44px]"
                          >
                            로그 보기
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
            {panelTab === 'files' && (
              <div className="p-4">
                <p className="text-caption text-text-tertiary">
                  세션에서 변경된 파일 목록이 여기에 표시됩니다.
                </p>
              </div>
            )}
            {panelTab === 'plans' && <PlanTab />}
          </div>
        </aside>
      </>
    )
  }

  // Desktop layout
  return (
    <>
      {/* Overlay for full mode */}
      {panelMode === 'full' && (
        <div
          className="fixed inset-0 bg-surface-overlay z-40"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <aside
        data-testid="side-panel"
        className={[
          'absolute top-0 right-0 h-full bg-surface border-l border-border z-30',
          'flex flex-col',
          'transition-all duration-panel ease-devflow',
          panelMode === 'peek' ? 'w-[40%] min-w-[400px] max-w-[50%]' : '',
          panelMode === 'full' ? 'w-[80%] max-w-[900px] shadow-elevation-3 z-50' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              data-testid="panel-close-btn"
              onClick={closePanel}
              className="p-1 rounded-button hover:bg-surface-hover text-text-secondary"
              title="닫기 (ESC)"
            >
              <X size={16} />
            </button>
            {selectedNode && (
              <h2 className="text-node-title-lg text-text-primary truncate">
                {selectedNode.title}
              </h2>
            )}
          </div>
          <button
            data-testid="panel-fullscreen-btn"
            onClick={toggleFullPage}
            className="p-1 rounded-button hover:bg-surface-hover text-text-secondary"
            title={panelMode === 'full' ? '축소' : '전체 화면'}
          >
            {panelMode === 'full' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Tabs */}
        <PanelTabs />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {panelTab === 'overview' && isLoading && (
            <div className="flex items-center justify-center py-12">
              <span className="text-caption text-text-tertiary">로딩 중...</span>
            </div>
          )}
          {panelTab === 'overview' && !isLoading && selectedNode && (
            <NodeDetailPanel />
          )}
          {panelTab === 'sessions' && (
            <div className="p-4 flex flex-col gap-3">
              {viewingSessionId ? (
                <div>
                  <button
                    onClick={() => setViewingSessionId(null)}
                    className="text-caption text-accent hover:underline mb-3"
                  >
                    &larr; 세션 목록으로
                  </button>
                  <SessionLogViewer sessionId={viewingSessionId} />
                </div>
              ) : (
                <>
                  {sessions.length === 0 ? (
                    <p className="text-caption text-text-tertiary">
                      아직 세션이 없습니다.
                    </p>
                  ) : (
                    sessions.map((session) => (
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
                    ))
                  )}
                </>
              )}
            </div>
          )}
          {panelTab === 'files' && (
            <div className="p-4">
              <p className="text-caption text-text-tertiary">
                세션에서 변경된 파일 목록이 여기에 표시됩니다.
              </p>
            </div>
          )}
          {panelTab === 'plans' && <PlanTab />}
        </div>
      </aside>
    </>
  )
}
