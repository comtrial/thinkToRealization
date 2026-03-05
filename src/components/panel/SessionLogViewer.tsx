'use client'

import { useEffect } from 'react'
import { useSessionStore } from '@/stores/session-store'
import { useNodeStore } from '@/stores/node-store'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

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
            msg.highlightId ? 'ring-2 ring-yellow-400/40 bg-yellow-50' : '',
          ].join(' ')}
        >
          {/* Role badge */}
          <div className="mb-2">
            <span
              className={[
                'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full',
                msg.role === 'user'
                  ? 'bg-accent/10 text-accent'
                  : 'bg-emerald-100 text-emerald-700',
              ].join(' ')}
            >
              {msg.role === 'user' ? 'User' : 'Claude'}
            </span>
          </div>

          {/* Content — both user and assistant use MarkdownRenderer */}
          <div className="text-body text-text-primary break-words">
            <MarkdownRenderer content={msg.content} highlight />
          </div>

          {/* Highlight toggle button (assistant messages only) */}
          {msg.role === 'assistant' && selectedNode && (
            <button
              className={[
                'absolute top-2 right-2 p-1 rounded-button',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                msg.highlightId ? 'opacity-100 text-yellow-500' : 'text-text-tertiary hover:text-yellow-500',
              ].join(' ')}
              onClick={async () => {
                if (msg.highlightId) {
                  await removeDecision(msg.highlightId)
                  useSessionStore.setState((s) => ({
                    sessionLog: s.sessionLog?.map((m) =>
                      m.index === msg.index ? { ...m, highlightId: null } : m
                    ) ?? null,
                  }))
                } else {
                  const newDecision = await addDecision(selectedNode.id, msg.content, sessionId)
                  if (newDecision) {
                    useSessionStore.setState((s) => ({
                      sessionLog: s.sessionLog?.map((m) =>
                        m.index === msg.index ? { ...m, highlightId: newDecision.id } : m
                      ) ?? null,
                    }))
                  }
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
