'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, Pencil, Trash2 } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuthStore } from '@/stores/auth-store'
import type { CommentResponse } from '@/lib/types/api'

interface CommentSectionProps {
  nodeId: string
}

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

export function CommentSection({ nodeId }: CommentSectionProps) {
  const currentUser = useAuthStore((s) => s.user)
  const [comments, setComments] = useState<CommentResponse[]>([])
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/comments`)
      if (res.ok) {
        const { data } = await res.json()
        setComments(data)
      }
    } catch { /* silently fail */ }
  }, [nodeId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/nodes/${nodeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setComments((prev) => [...prev, data])
        setNewComment('')
      }
    } catch { /* silently fail */ }
    setSubmitting(false)
  }

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setComments((prev) => prev.map((c) => (c.id === id ? data : c)))
        setEditingId(null)
      }
    } catch { /* silently fail */ }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id))
      }
    } catch { /* silently fail */ }
  }

  return (
    <div>
      <label className="text-caption text-text-tertiary mb-2 block">
        댓글 ({comments.length})
      </label>

      {/* Comment list */}
      <div className="flex flex-col gap-3 mb-3">
        {comments.map((c) => {
          const isOwn = currentUser?.id === c.user.id
          const isEditing = editingId === c.id

          return (
            <div key={c.id} className="flex gap-2">
              <UserAvatar name={c.user.name} avatarUrl={c.user.avatarUrl} size={24} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-caption font-medium text-text-primary">{c.user.name}</span>
                  <span className="text-[10px] text-text-tertiary">{timeAgo(c.createdAt)}</span>
                  {isOwn && !isEditing && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => { setEditingId(c.id); setEditContent(c.content) }}
                        className="p-0.5 rounded hover:bg-surface-hover text-text-tertiary"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-0.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEdit(c.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 rounded-button border border-border bg-surface text-caption text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => handleEdit(c.id)}
                      className="px-2 py-1 text-caption text-accent hover:bg-accent/10 rounded-button"
                    >
                      저장
                    </button>
                  </div>
                ) : (
                  <p className="text-caption text-text-secondary mt-0.5 whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New comment input */}
      <div className="flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="댓글을 입력하세요..."
          className="flex-1 px-3 py-2 rounded-button border border-border bg-surface text-caption text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          className="px-3 py-2 rounded-button bg-accent text-white disabled:opacity-40 hover:bg-accent/90 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
