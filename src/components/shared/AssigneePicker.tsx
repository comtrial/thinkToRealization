'use client'

import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { UserPlus, X } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import type { UserResponse } from '@/lib/types/api'

interface AssigneePickerProps {
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatarUrl: string | null
  onAssign: (userId: string | null) => void
}

export function AssigneePicker({ assigneeId, assigneeName, assigneeAvatarUrl, onAssign }: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserResponse[]>([])

  useEffect(() => {
    if (open && users.length === 0) {
      fetch('/api/users')
        .then((r) => r.json())
        .then((json) => setUsers(json.data ?? []))
        .catch(() => {})
    }
  }, [open, users.length])

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-text-tertiary">담당자</label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-button border border-border hover:bg-surface-hover transition-colors text-left">
            {assigneeId && assigneeName ? (
              <>
                <UserAvatar name={assigneeName} avatarUrl={assigneeAvatarUrl} size={20} />
                <span className="text-caption text-text-primary truncate flex-1">{assigneeName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onAssign(null) }}
                  className="p-0.5 rounded hover:bg-surface-active text-text-tertiary"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <UserPlus size={16} className="text-text-tertiary" />
                <span className="text-caption text-text-tertiary">담당자 지정</span>
              </>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="w-[200px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-1.5 z-50"
            sideOffset={4}
            align="start"
          >
            {users.length === 0 ? (
              <p className="text-caption text-text-tertiary px-2 py-1">사용자 없음</p>
            ) : (
              <ul className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => { onAssign(user.id); setOpen(false) }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-button text-caption transition-colors ${
                        user.id === assigneeId
                          ? 'bg-surface-active text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={18} />
                      <span className="truncate">{user.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
