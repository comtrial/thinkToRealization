'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle } from 'lucide-react'
import { useProject } from '@/components/providers/ProjectProvider'
import { useToast } from '@/components/shared/Toast'

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
}: DeleteProjectDialogProps) {
  const { refreshProjects, setCurrentProject } = useProject()
  const { addToast } = useToast()

  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isConfirmed = confirmText === projectTitle

  const reset = useCallback(() => {
    setConfirmText('')
    setError('')
    setSubmitting(false)
  }, [])

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConfirmed || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error?.message ?? '프로젝트 삭제에 실패했습니다')
        return
      }

      addToast('success', `'${projectTitle}' 프로젝트가 삭제되었습니다`)
      setCurrentProject(null)
      await refreshProjects()
      reset()
      onOpenChange(false)
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[85vh] bg-surface border border-border rounded-dropdown shadow-elevation-3 p-6 z-50 focus:outline-none overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-section-header text-red-600 font-semibold flex items-center gap-2">
              <AlertTriangle size={18} />
              프로젝트 삭제
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-surface-hover text-text-tertiary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-body text-text-secondary mb-4">
            이 작업은 되돌릴 수 없습니다. 프로젝트와 관련된 모든 노드, 세션, 결정사항이 비활성화됩니다.
          </Dialog.Description>

          <form onSubmit={handleDelete} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary">
                확인을 위해 프로젝트 이름 <strong className="text-text-primary">{projectTitle}</strong>을(를) 입력해주세요
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={projectTitle}
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                autoComplete="off"
              />
            </label>

            {error && <p className="text-caption text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-body text-text-secondary rounded-button hover:bg-surface-hover transition-colors"
                >
                  취소
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!isConfirmed || submitting}
                className="px-4 py-2 text-body text-white bg-red-600 rounded-button hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '삭제 중...' : '프로젝트 삭제'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
