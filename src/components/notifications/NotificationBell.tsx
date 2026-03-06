'use client'

import { useEffect, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Bell, Check, MessageSquare, UserPlus } from 'lucide-react'
import { useNotificationStore, type NotificationItem } from '@/stores/notification-store'
import { useUIStore } from '@/stores/ui-store'

const POLL_INTERVAL = 30_000

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

function NotificationRow({ item, onRead }: { item: NotificationItem; onRead: () => void }) {
  const openPanel = useUIStore((s) => s.openPanel)

  const handleClick = () => {
    if (!item.isRead) onRead()
    if (item.nodeId) openPanel(item.nodeId)
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover ${
        item.isRead ? '' : 'bg-accent/5'
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {item.type === 'comment' ? (
          <MessageSquare size={14} className="text-blue-500" />
        ) : (
          <UserPlus size={14} className="text-purple-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-caption ${item.isRead ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
          {item.body}
        </p>
        <span className="text-[10px] text-text-tertiary">{timeAgo(item.createdAt)}</span>
      </div>
      {!item.isRead && (
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
      )}
    </button>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead } =
    useNotificationStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchUnreadCount()
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchUnreadCount])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover transition-colors">
          <Bell size={18} className="text-text-secondary" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-[340px] bg-surface border border-border rounded-dropdown shadow-elevation-3 z-50 overflow-hidden"
          sideOffset={8}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-body font-medium text-text-primary">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] text-accent hover:underline"
              >
                <Check size={12} />
                모두 읽음
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="text-caption text-text-tertiary text-center py-8">알림이 없습니다</p>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} item={n} onRead={() => markAsRead(n.id)} />
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
