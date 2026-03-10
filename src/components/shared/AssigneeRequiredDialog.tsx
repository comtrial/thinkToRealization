'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, UserPlus } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useToast } from '@/components/shared/Toast'
import { UserAvatar } from '@/components/shared/UserAvatar'
import type { UserResponse } from '@/lib/types/api'

export function AssigneeRequiredDialog() {
  const assigneeDialogOpen = useNodeStore((s) => s.assigneeDialogOpen)
  const pendingStatusChange = useNodeStore((s) => s.pendingStatusChange)
  const closeAssigneeDialog = useNodeStore((s) => s.closeAssigneeDialog)
  const updateAssigneeAndStatus = useNodeStore((s) => s.updateAssigneeAndStatus)
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const { addToast } = useToast()

  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch project members when dialog opens
  useEffect(() => {
    if (assigneeDialogOpen && selectedNode?.projectId) {
      setLoading(true)
      fetch(`/api/projects/${selectedNode.projectId}/members`)
        .then((r) => r.json())
        .then((json) => {
          const members = (json.data ?? []) as { user: UserResponse }[]
          setUsers(members.map((m) => m.user))
        })
        .catch(() => {
          setUsers([])
        })
        .finally(() => setLoading(false))
    }
  }, [assigneeDialogOpen, selectedNode?.projectId])

  const handleSelectUser = async (userId: string) => {
    if (!pendingStatusChange || submitting) return

    setSubmitting(true)
    const result = await updateAssigneeAndStatus(
      pendingStatusChange.nodeId,
      userId,
      pendingStatusChange.status
    )

    if (result.ok) {
      addToast('success', '담당자 배정 및 상태 변경이 완료되었습니다')
      closeAssigneeDialog()
    } else {
      addToast('error', result.error || '처리에 실패했습니다')
    }
    setSubmitting(false)
  }

  const statusLabel =
    pendingStatusChange?.status === 'in_progress'
      ? 'In Progress'
      : pendingStatusChange?.status === 'done'
        ? 'Done'
        : pendingStatusChange?.status ?? ''

  return (
    <Dialog.Root
      open={assigneeDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeAssigneeDialog()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[85vh] bg-surface border border-border rounded-dropdown shadow-elevation-3 p-6 z-50 focus:outline-none overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-section-header text-text-primary font-semibold flex items-center gap-2">
              <UserPlus size={18} className="text-accent" />
              담당자 배정 필요
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-surface-hover text-text-tertiary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-body text-text-secondary mb-4">
            <strong>{statusLabel}</strong> 상태로 변경하려면 담당자를 먼저 배정해야 합니다.
            아래에서 담당자를 선택해주세요.
          </Dialog.Description>

          {loading ? (
            <div className="py-6 text-center text-caption text-text-tertiary">
              멤버 목록을 불러오는 중...
            </div>
          ) : users.length === 0 ? (
            <div className="py-6 text-center text-caption text-text-tertiary">
              프로젝트 멤버가 없습니다
            </div>
          ) : (
            <ul className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    onClick={() => handleSelectUser(user.id)}
                    disabled={submitting}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-body text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={28} />
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-medium truncate">{user.name}</span>
                      <span className="text-caption text-text-tertiary truncate">{user.email}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end mt-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 text-body text-text-secondary rounded-button hover:bg-surface-hover transition-colors"
              >
                취소
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
