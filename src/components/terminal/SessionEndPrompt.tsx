'use client'

import { useState, useEffect, useRef } from 'react'
import { useSessionStore } from '@/stores/session-store'

export function SessionEndPrompt() {
  const endSession = useSessionStore((s) => s.endSession)
  const dismissEndPrompt = useSessionStore((s) => s.dismissEndPrompt)
  const [isHovered, setIsHovered] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setTimeout(() => {
      setIsFadingOut(true)
      setTimeout(() => {
        dismissEndPrompt()
      }, 300)
    }, 3000)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isHovered, dismissEndPrompt])

  return (
    <div
      className={[
        'flex items-center justify-between px-4 h-12',
        'bg-surface-hover border-t border-border',
        isFadingOut ? 'animate-fadeOut' : 'animate-slideUp',
      ].join(' ')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-caption text-text-secondary">
        세션이 종료되었습니다.
      </span>
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 rounded-button text-badge bg-green-600 text-white hover:bg-green-700 transition-colors"
          onClick={() => endSession(true)}
        >
          완료로 표시
        </button>
        <button
          className="px-3 py-1.5 rounded-button text-badge bg-surface border border-border text-text-secondary hover:bg-surface-hover transition-colors"
          onClick={() => endSession(false)}
        >
          나중에 계속
        </button>
        <button
          className="px-2 py-1.5 rounded-button text-badge text-text-tertiary hover:text-text-secondary transition-colors"
          onClick={dismissEndPrompt}
        >
          취소
        </button>
      </div>
    </div>
  )
}
