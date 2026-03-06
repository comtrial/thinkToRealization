'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useProject } from '@/components/providers/ProjectProvider'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { refreshProjects, setCurrentProject } = useProject()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    setError('')
    setSubmitting(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? '프로젝트 생성에 실패했습니다')
        return
      }

      await refreshProjects()
      if (json.data) {
        setCurrentProject(json.data)
      }
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
        <Dialog.Content data-testid="create-project-dialog" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[85vh] bg-surface border border-border rounded-dropdown shadow-elevation-3 p-6 z-50 focus:outline-none overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-section-header text-text-primary font-semibold">
              새 프로젝트
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-surface-hover text-text-tertiary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">
                프로젝트 이름 <span className="text-red-500">*</span>
              </span>
              <input
                data-testid="project-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: DevFlow v2"
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">설명</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트에 대한 간단한 설명"
                rows={2}
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent resize-none"
              />
            </label>

            {error && (
              <p className="text-caption text-red-500">{error}</p>
            )}

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
                data-testid="create-project-submit"
                type="submit"
                disabled={submitting || !title.trim()}
                className="px-4 py-2 text-body text-white bg-accent rounded-button hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
