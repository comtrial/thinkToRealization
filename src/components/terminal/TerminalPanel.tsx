'use client'

import { useRef, useEffect } from 'react'
import { ptyDataEmitter } from '@/lib/pty-emitter'
import { useWebSocket } from '@/components/providers/WebSocketProvider'

interface TerminalPanelProps {
  nodeId: string | null
}

export function TerminalPanel({ nodeId }: TerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<unknown>(null)
  const fitAddonRef = useRef<unknown>(null)
  const { sendPTYInput, sendPTYResize } = useWebSocket()
  const sendPTYInputRef = useRef(sendPTYInput)
  const sendPTYResizeRef = useRef(sendPTYResize)
  sendPTYInputRef.current = sendPTYInput
  sendPTYResizeRef.current = sendPTYResize

  useEffect(() => {
    if (!termRef.current || !nodeId) return

    let disposed = false
    let cleanup: (() => void) | undefined

    // Dynamically import xterm to avoid SSR issues (xterm uses `self`)
    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || !termRef.current) return

      const isMobileView = window.matchMedia('(max-width: 768px)').matches

      const term = new Terminal({
        theme: {
          background: '#1E1E1E',
          foreground: '#D4D4D4',
          cursor: '#D4D4D4',
          selectionBackground: 'rgba(79, 70, 229, 0.3)',
          black: '#1E1E1E',
          red: '#F87171',
          green: '#22C55E',
          yellow: '#FBBF24',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#D4D4D4',
        },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: isMobileView ? 14 : 13,
        lineHeight: 1.5,
        cursorBlink: true,
        scrollback: isMobileView ? 2000 : 10000,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termRef.current!)

      // Delay fit to ensure container has dimensions
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
        } catch {
          // ignore
        }
      })

      // PTY input: send keystrokes to server (use ref to avoid stale closure)
      const dataDisposable = term.onData((data: string) => {
        sendPTYInputRef.current(nodeId, data)
      })

      // PTY output: receive data from server via emitter (bypasses Zustand)
      const handler = (data: string) => {
        term.write(data)
      }
      ptyDataEmitter.on(nodeId, handler)

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          sendPTYResizeRef.current(nodeId, term.cols, term.rows)
        } catch {
          // ignore
        }
      })
      const el = termRef.current
      if (el) {
        resizeObserver.observe(el)
      }

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      cleanup = () => {
        dataDisposable.dispose()
        ptyDataEmitter.off(nodeId, handler)
        resizeObserver.disconnect()
        term.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [nodeId])

  if (!nodeId) {
    return (
      <div className="w-full h-full bg-terminal-bg rounded-b-node flex items-center justify-center">
        <span className="text-terminal text-text-tertiary">
          세션을 시작하면 터미널이 여기에 표시됩니다.
        </span>
      </div>
    )
  }

  return (
    <div
      ref={termRef}
      className="w-full h-full bg-terminal-bg rounded-b-node overflow-hidden"
    />
  )
}
