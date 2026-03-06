'use client'

import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { ptyDataEmitter } from '@/lib/pty-emitter'
import { useSessionStore } from '@/stores/session-store'
import { useCanvasStore } from '@/stores/canvas-store'

interface WSContextValue {
  sendPTYInput: (nodeId: string, data: string) => void
  sendPTYResize: (nodeId: string, cols: number, rows: number) => void
  sendSessionStart: (nodeId: string, opts?: { title?: string; cols?: number; rows?: number; cwd?: string }) => void
  sendSessionEnd: (nodeId: string, markDone?: boolean) => void
  sendSessionResume: (nodeId: string, sessionId: string, opts?: { cols?: number; rows?: number; cwd?: string }) => void
  sendMessage: (type: string, payload: object) => void
}

const WebSocketContext = createContext<WSContextValue>({
  sendPTYInput: () => {},
  sendPTYResize: () => {},
  sendSessionStart: () => {},
  sendSessionEnd: () => {},
  sendSessionResume: () => {},
  sendMessage: () => {},
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const intentionalClose = useRef(false)

  const connect = useCallback(() => {
    // Skip WebSocket in deployed environments (HTTPS — no local WS server)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return
    }

    // Close any existing connection before creating a new one
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }

    const port = 3001
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const ws = new WebSocket(`ws://${host}:${port}/ws`)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'pty:data':
            ptyDataEmitter.emit(msg.payload.nodeId, msg.payload.data)
            break
          case 'session:started':
            useSessionStore.getState().handleSessionStarted(msg.payload)
            break
          case 'session:ended':
            useSessionStore.getState().handleSessionEnded(msg.payload)
            break
          case 'node:stateChanged':
            useCanvasStore.getState().updateNodeData(msg.payload.nodeId, {
              status: msg.payload.toStatus,
            })
            break
          case 'node:fileCountUpdated':
            useCanvasStore.getState().updateNodeData(msg.payload.nodeId, {
              fileChangeCount: msg.payload.count,
            })
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      // Only reconnect if this is still the active connection
      if (wsRef.current !== ws) return
      if (intentionalClose.current) return

      // Stop reconnecting after max attempts (e.g. no WS server in deployed env)
      const MAX_RECONNECT_ATTEMPTS = 5
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.info('[WS] Max reconnect attempts reached — running in offline mode')
        return
      }

      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000)
      setTimeout(connect, delay)
      reconnectAttempts.current++
    }

    ws.onopen = () => {
      const wasReconnect = reconnectAttempts.current > 0
      reconnectAttempts.current = 0
      // Re-fetch canvas data on reconnect to restore sync
      if (wasReconnect) {
        const canvasState = useCanvasStore.getState()
        // Find current project from existing nodes (they contain projectId in data)
        const firstNode = canvasState.nodes[0]
        if (firstNode && firstNode.data && typeof firstNode.data === 'object' && 'projectId' in firstNode.data) {
          canvasState.loadCanvas(firstNode.data.projectId as string)
        }
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    intentionalClose.current = false
    connect()
    return () => {
      intentionalClose.current = true
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendPTYInput = useCallback((nodeId: string, data: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'pty:input', payload: { nodeId, data } }))
  }, [])

  const sendPTYResize = useCallback((nodeId: string, cols: number, rows: number) => {
    wsRef.current?.send(JSON.stringify({ type: 'pty:resize', payload: { nodeId, cols, rows } }))
  }, [])

  const sendSessionStart = useCallback((nodeId: string, opts?: { title?: string; cols?: number; rows?: number; cwd?: string }) => {
    wsRef.current?.send(JSON.stringify({
      type: 'session:start',
      payload: { nodeId, cols: opts?.cols ?? 80, rows: opts?.rows ?? 24, title: opts?.title, cwd: opts?.cwd },
    }))
  }, [])

  const sendSessionEnd = useCallback((nodeId: string, markDone = false) => {
    wsRef.current?.send(JSON.stringify({
      type: 'session:end',
      payload: { nodeId, markDone },
    }))
  }, [])

  const sendSessionResume = useCallback((nodeId: string, sessionId: string, opts?: { cols?: number; rows?: number; cwd?: string }) => {
    wsRef.current?.send(JSON.stringify({
      type: 'session:resume',
      payload: { nodeId, sessionId, cols: opts?.cols ?? 80, rows: opts?.rows ?? 24, cwd: opts?.cwd },
    }))
  }, [])

  const sendMessage = useCallback((type: string, payload: object) => {
    wsRef.current?.send(JSON.stringify({ type, payload }))
  }, [])

  return (
    <WebSocketContext.Provider value={{ sendPTYInput, sendPTYResize, sendSessionStart, sendSessionEnd, sendSessionResume, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}
