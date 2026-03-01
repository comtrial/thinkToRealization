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
  useEffect(() => {
    if (!termRef.current || !nodeId) return

    let disposed = false

    // Dynamically import xterm to avoid SSR issues (xterm uses `self`)
    Promise.all([
      import('xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || !termRef.current) return

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
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: true,
        scrollback: 10000,
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

      // PTY input: send keystrokes to server
      const dataDisposable = term.onData((data: string) => {
        sendPTYInput(nodeId, data)
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
          sendPTYResize(nodeId, term.cols, term.rows)
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
      // terminal ready

      // Store cleanup function
      ;(termRef.current as HTMLDivElement & { __cleanup?: () => void }).__cleanup = () => {
        dataDisposable.dispose()
        ptyDataEmitter.off(nodeId, handler)
        resizeObserver.disconnect()
        term.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    })

    // Capture ref for cleanup
    const currentEl = termRef.current as HTMLDivElement & { __cleanup?: () => void } | null

    return () => {
      disposed = true
      if (currentEl?.__cleanup) {
        currentEl.__cleanup()
        currentEl.__cleanup = undefined
      }
    }
  }, [nodeId, sendPTYInput, sendPTYResize])

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
