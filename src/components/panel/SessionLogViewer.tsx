'use client'

import { useEffect } from 'react'
import { useSessionStore } from '@/stores/session-store'
import { useNodeStore } from '@/stores/node-store'

interface SessionLogViewerProps {
  sessionId: string
}

export function SessionLogViewer({ sessionId }: SessionLogViewerProps) {
  const sessionLog = useSessionStore((s) => s.sessionLog)
  const loadSessionLog = useSessionStore((s) => s.loadSessionLog)
  const addDecision = useNodeStore((s) => s.addDecision)
  const removeDecision = useNodeStore((s) => s.removeDecision)
  const selectedNode = useNodeStore((s) => s.selectedNode)

  useEffect(() => {
    loadSessionLog(sessionId)
  }, [sessionId, loadSessionLog])

  if (!sessionLog) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-caption text-text-tertiary">로그 로딩 중...</span>
      </div>
    )
  }

  if (sessionLog.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-caption text-text-tertiary">세션 로그가 비어있습니다.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sessionLog.map((msg) => (
        <div
          key={msg.index}
          className={[
            'relative group rounded-node p-3',
            msg.role === 'user'
              ? 'bg-accent-light border border-accent/20'
              : 'bg-surface-hover border border-border',
            msg.highlightId ? 'ring-2 ring-accent/20 bg-accent/5' : '',
          ].join(' ')}
        >
          <div className="text-caption text-text-tertiary mb-1">
            {msg.role === 'user' ? 'User' : 'Claude'}
          </div>
          <div className="text-body text-text-primary whitespace-pre-wrap break-words">
            {msg.content}
          </div>

          {/* Highlight button (assistant messages only) */}
          {msg.role === 'assistant' && selectedNode && (
            <button
              className={[
                'absolute top-2 right-2 p-1 rounded-button',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                msg.highlightId ? 'opacity-100 text-accent' : 'text-text-tertiary hover:text-accent',
              ].join(' ')}
              onClick={() => {
                if (msg.highlightId) {
                  removeDecision(msg.highlightId)
                } else {
                  addDecision(selectedNode.id, msg.content, sessionId)
                }
              }}
              title={msg.highlightId ? '결정사항 해제' : '결정사항으로 저장'}
            >
              {msg.highlightId ? '\u2B50' : '\u2606'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
