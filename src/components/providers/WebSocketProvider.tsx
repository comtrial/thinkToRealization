'use client'

import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { ptyDataEmitter } from '@/lib/pty-emitter'
import { useSessionStore } from '@/stores/session-store'
import { useCanvasStore } from '@/stores/canvas-store'

interface WSContextValue {
  sendPTYInput: (nodeId: string, data: string) => void
  sendPTYResize: (nodeId: string, cols: number, rows: number) => void
}

const WebSocketContext = createContext<WSContextValue>({
  sendPTYInput: () => {},
  sendPTYResize: () => {},
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
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
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000)
      setTimeout(connect, delay)
      reconnectAttempts.current++
    }

    ws.onopen = () => {
      reconnectAttempts.current = 0
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const sendPTYInput = useCallback((nodeId: string, data: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'pty:input', payload: { nodeId, data } }))
  }, [])

  const sendPTYResize = useCallback((nodeId: string, cols: number, rows: number) => {
    wsRef.current?.send(JSON.stringify({ type: 'pty:resize', payload: { nodeId, cols, rows } }))
  }, [])

  return (
    <WebSocketContext.Provider value={{ sendPTYInput, sendPTYResize }}>
      {children}
    </WebSocketContext.Provider>
  )
}
