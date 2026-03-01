'use client'

import { useSessionStore } from '@/stores/session-store'
import { useUIStore } from '@/stores/ui-store'
import { Play, Square } from 'lucide-react'

interface SessionControlsProps {
  nodeId: string
}

export function SessionControls({ nodeId }: SessionControlsProps) {
  const activeSession = useSessionStore((s) => s.activeSession)
  const isSessionStarting = useSessionStore((s) => s.isSessionStarting)
  const setTerminalExpanded = useUIStore((s) => s.setTerminalExpanded)

  const isActive = activeSession?.nodeId === nodeId

  const handleStartSession = () => {
    // Send session:start via WebSocket
    const port = 3001
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const ws = new WebSocket(`ws://${host}:${port}/ws?nodeId=${nodeId}`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'session:start',
        payload: { nodeId, cols: 80, rows: 24 },
      }))
      setTerminalExpanded(true)
      // Close this temporary connection - the main WebSocketProvider will handle ongoing communication
      setTimeout(() => ws.close(), 500)
    }

    ws.onerror = () => {
      console.error('Failed to connect to WebSocket for session start')
    }
  }

  const handleEndSession = () => {
    if (!activeSession) return
    const port = 3001
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const ws = new WebSocket(`ws://${host}:${port}/ws?nodeId=${nodeId}`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'session:end',
        payload: { nodeId, markDone: false },
      }))
      setTimeout(() => ws.close(), 500)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <>
          {/* Active session indicator */}
          <span className="flex items-center gap-1.5 text-caption text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            세션 활성
          </span>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1 px-2.5 py-1 rounded-button text-badge bg-surface border border-border text-text-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <Square size={12} />
            세션 종료
          </button>
        </>
      ) : (
        <button
          onClick={handleStartSession}
          disabled={isSessionStarting}
          className="flex items-center gap-1 px-2.5 py-1 rounded-button text-badge bg-accent text-text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Play size={12} />
          {isSessionStarting ? '시작 중...' : '새 세션 시작'}
        </button>
      )}
    </div>
  )
}
