'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useCanvasStore } from '@/stores/canvas-store'

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      // Cmd+K: Command Palette (always works)
      if (isMod && e.key === 'k') {
        e.preventDefault()
        useUIStore.getState().toggleCommandPalette()
        return
      }

      // Cmd+S: Save (no-op, prevent browser save)
      if (isMod && e.key === 's') {
        e.preventDefault()
        return
      }

      // Escape: Close panel/dialog
      if (e.key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.commandPaletteOpen) {
          ui.toggleCommandPalette()
          return
        }
        if (ui.panelMode === 'full') {
          ui.toggleFullPage()
          return
        }
        if (ui.panelMode === 'peek') {
          ui.closePanel()
          return
        }
        return
      }

      // Do not process below shortcuts when input is focused
      if (isInputFocused()) return

      // Cmd+Z: Undo / Cmd+Shift+Z: Redo
      if (isMod && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          useCanvasStore.getState().redo()
        } else {
          useCanvasStore.getState().undo()
        }
        return
      }

      // Cmd+1: Dashboard tab
      if (isMod && e.key === '1') {
        e.preventDefault()
        useUIStore.getState().setActiveTab('dashboard')
        return
      }

      // Cmd+2: Canvas tab
      if (isMod && e.key === '2') {
        e.preventDefault()
        useUIStore.getState().setActiveTab('canvas')
        return
      }

      // Cmd+\: Toggle sidebar
      if (isMod && e.key === '\\') {
        e.preventDefault()
        useUIStore.getState().toggleSidebar()
        return
      }

      // [ key: Toggle sidebar (Linear pattern)
      if (e.key === '[') {
        useUIStore.getState().toggleSidebar()
        return
      }

      // Cmd+Enter: Toggle full page panel
      if (isMod && e.key === 'Enter') {
        e.preventDefault()
        useUIStore.getState().toggleFullPage()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
