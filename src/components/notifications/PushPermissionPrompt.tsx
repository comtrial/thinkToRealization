'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { isPushSupported, registerAndSubscribe } from '@/lib/push/register-sw'

const DISMISSED_KEY = 'ttr-push-prompt-dismissed'

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    // Check if already subscribed or permission denied
    if (Notification.permission === 'granted') {
      // Already granted — register SW silently in case subscription was lost
      registerAndSubscribe().catch(() => {})
      return
    }
    if (Notification.permission === 'denied') return

    // Show prompt for 'default' (not yet asked)
    setVisible(true)
  }, [])

  const handleAllow = async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await registerAndSubscribe()
      } else {
        localStorage.setItem(DISMISSED_KEY, '1')
      }
    } catch {
      // Ignore errors
    }
    setVisible(false)
    setLoading(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-surface border border-border rounded-dropdown shadow-elevation-3 px-4 py-3 flex items-center gap-3">
      <Bell size={20} className="text-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-body font-medium text-text-primary">알림 허용</p>
        <p className="text-caption text-text-secondary">
          댓글, 배정, 상태 변경 알림을 받으세요
        </p>
      </div>
      <button
        onClick={handleAllow}
        disabled={loading}
        className="px-3 py-1.5 bg-accent text-white text-caption font-medium rounded-button hover:bg-accent/90 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {loading ? '...' : '허용'}
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
