"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WS_URL } from "@/lib/constants";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface UseTerminalOptions {
  sessionId: string | null;
  disabled?: boolean;
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  status: ConnectionStatus;
  reconnect: () => void;
  sendInput: (data: string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function setupIMEHandlers(
  textarea: HTMLTextAreaElement,
  composingRef: React.MutableRefObject<boolean>,
  wsRef: React.MutableRefObject<WebSocket | null>
) {
  // Track IME composition state
  textarea.addEventListener(
    "compositionstart",
    () => {
      composingRef.current = true;
    },
    true
  );

  textarea.addEventListener(
    "compositionend",
    (e: CompositionEvent) => {
      composingRef.current = false;
      // Send the final composed text (e.g., "한" not "ㅎㅏㄴ")
      if (e.data && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data: e.data }));
      }
      // Clear the textarea so xterm doesn't double-process
      textarea.value = "";
    },
    true
  );

  // Prevent xterm.js from processing input events during IME composition.
  // This is the critical fix: xterm listens to beforeinput/input events
  // and processes each keystroke. By stopping propagation during composition,
  // intermediate jamo (ㅎ,ㅏ,ㄴ) are NOT sent — only the final composed
  // character from compositionend is sent.
  textarea.addEventListener(
    "beforeinput",
    (e: InputEvent) => {
      if (composingRef.current || e.isComposing) {
        e.stopImmediatePropagation();
      }
    },
    true // capture phase — fires BEFORE xterm's handler
  );

  textarea.addEventListener(
    "input",
    (e: Event) => {
      const inputEvent = e as InputEvent;
      if (composingRef.current || inputEvent.isComposing) {
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

export function useTerminal({
  sessionId,
  disabled = false,
}: UseTerminalOptions): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);
  const imeSetupRef = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  // Use ref for connect so scheduleReconnect can call latest version
  const connectRef = useRef<() => void>(() => {});

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitAddonRef.current = null;
    imeSetupRef.current = false;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus("error");
      return;
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    );
    reconnectAttemptRef.current++;

    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (!sessionId || disabled) return;

    // Create terminal instance if not exists
    if (!termRef.current && terminalRef.current) {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const term = new Terminal({
        cursorBlink: true,
        fontSize: isMobile ? 12 : 14,
        fontFamily: "'JetBrains Mono', monospace",
        theme: {
          background: "#030712",
          foreground: "#e5e7eb",
          cursor: "#e5e7eb",
          selectionBackground: "#3b82f680",
        },
        scrollback: 10000,
        convertEol: true,
        allowProposedApi: true,
        smoothScrollDuration: isMobile ? 100 : 0,
        fastScrollModifier: "none",
        scrollSensitivity: isMobile ? 3 : 1,
      });

      // Block xterm key processing during IME composition
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.isComposing || e.keyCode === 229) {
          return false;
        }
        return true;
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

      try {
        fitAddon.fit();
      } catch {
        // element may not have dimensions yet
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Set up IME handlers on xterm's internal textarea
      // Use term.textarea (xterm 5.x exposes this) or fallback to querySelector
      const textarea =
        (term as unknown as { textarea?: HTMLTextAreaElement }).textarea ||
        (terminalRef.current.querySelector(
          ".xterm-helper-textarea"
        ) as HTMLTextAreaElement | null);

      if (textarea && !imeSetupRef.current) {
        setupIMEHandlers(textarea, composingRef, wsRef);
        imeSetupRef.current = true;
      }
    }

    const term = termRef.current;
    if (!term) return;

    setStatus("connecting");

    const ws = new WebSocket(
      `${WS_URL}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}`
    );
    wsRef.current = ws;

    // Forward terminal input to WebSocket (skip during IME composition)
    const inputDisposable = term.onData((data: string) => {
      if (composingRef.current) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttemptRef.current = 0;

      // Send initial resize
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // ignore
        }
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "output":
            term.write(msg.data);
            break;
          case "exit":
            term.writeln("\r\n\x1b[33m[세션 종료됨]\x1b[0m");
            setStatus("disconnected");
            break;
          case "error":
            term.writeln(`\r\n\x1b[31m[오류: ${msg.message}]\x1b[0m`);
            break;
          case "heartbeat":
          case "pong":
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      inputDisposable.dispose();
      setStatus("disconnected");
      scheduleReconnect();
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [sessionId, disabled, scheduleReconnect]);

  // Keep connectRef up to date
  connectRef.current = connect;

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    connect();
  }, [connect]);

  // Connect when sessionId changes
  useEffect(() => {
    cleanup();
    if (sessionId && !disabled) {
      // Slight delay to ensure DOM is mounted
      const timer = setTimeout(() => connect(), 50);
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    }
    return cleanup;
  }, [sessionId, disabled, cleanup, connect]);

  // Handle resize
  useEffect(() => {
    if (!terminalRef.current) return;

    const el = terminalRef.current;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "resize",
                cols: termRef.current.cols,
                rows: termRef.current.rows,
              })
            );
          }
        } catch {
          // ignore
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ping interval to keep connection alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data }));
    }
  }, []);

  return { terminalRef, status, reconnect, sendInput };
}
