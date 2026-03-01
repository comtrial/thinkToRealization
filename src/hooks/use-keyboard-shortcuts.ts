"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutHandlers {
  onPin?: () => void;
  onToggleFocusMode?: () => void;
  onNewSession?: () => void;
  onNextStage?: () => void;
  onPrevStage?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+P: Pin
      if (isMeta && !e.shiftKey && e.key === "p") {
        e.preventDefault();
        handlersRef.current.onPin?.();
        return;
      }

      // Cmd+\: Toggle focus mode
      if (isMeta && !e.shiftKey && e.key === "\\") {
        e.preventDefault();
        handlersRef.current.onToggleFocusMode?.();
        return;
      }

      // Cmd+Shift+N: New session
      if (isMeta && e.shiftKey && e.key === "N") {
        e.preventDefault();
        handlersRef.current.onNewSession?.();
        return;
      }

      // Cmd+Shift+Right: Next stage
      if (isMeta && e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        handlersRef.current.onNextStage?.();
        return;
      }

      // Cmd+Shift+Left: Previous stage
      if (isMeta && e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handlersRef.current.onPrevStage?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
