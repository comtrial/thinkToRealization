'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowUp, Pencil, Trash2 } from 'lucide-react'
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

function CommentContent({ content, source, sourceSession }: { content: string; source?: string; sourceSession?: string | null }) {
  const isCli = source === 'cli'
  const isSystem = source === 'system'

  return (
    <div className="mt-0.5">
      {isCli && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent mr-1.5 mb-0.5">
          CLI{sourceSession ? `: ${sourceSession}` : ''}
        </span>
      )}
      {isSystem && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 mr-1.5 mb-0.5">
          system
        </span>
      )}
      <p className={`text-[13px] whitespace-pre-wrap break-words leading-relaxed ${isCli || isSystem ? 'inline' : 'mt-0.5'} ${isSystem ? 'text-text-tertiary' : 'text-text-secondary'}`}>
        {content}
      </p>
    </div>
  )
}

export function CommentSection({ nodeId }: CommentSectionProps) {
  const currentUser = useAuthStore((s) => s.user)
  const [comments, setComments] = useState<CommentResponse[]>([])
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Auto-resize textarea
  const adjustTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }

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
        setFocused(false)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    <div className="border-t border-border/30 pt-5">
      {/* Activity header */}
      <h3 className="text-sm font-medium text-text-primary mb-4">Activity</h3>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="flex flex-col gap-4 mb-5">
          {comments.map((c) => {
            const isOwn = currentUser?.id === c.user.id
            const isEditing = editingId === c.id

            return (
              <div key={c.id} className="flex gap-3 group">
                <UserAvatar name={c.user.name} avatarUrl={c.user.avatarUrl} size={28} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary">{c.user.name}</span>
                    <span className="text-[11px] text-text-tertiary">{timeAgo(c.createdAt)}</span>
                    {isOwn && !isEditing && (
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(c.id); setEditContent(c.content) }}
                          className="p-1 rounded hover:bg-surface-hover text-text-tertiary"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1 rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEdit(c.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-surface text-[13px] text-text-primary focus:outline-none focus:border-accent"
                      />
                      <button
                        onClick={() => handleEdit(c.id)}
                        className="px-3 py-1.5 text-[12px] text-accent hover:bg-accent/10 rounded-lg"
                      >
                        저장
                      </button>
                    </div>
                  ) : (
                    <CommentContent content={c.content} source={c.source} sourceSession={c.sourceSession} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New comment input — Linear style textarea */}
      <div
        className={[
          'rounded-lg border transition-colors',
          focused ? 'border-border bg-surface shadow-sm' : 'border-border/50 bg-surface-hover/30',
        ].join(' ')}
      >
        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => { setNewComment(e.target.value); adjustTextarea() }}
          onFocus={() => setFocused(true)}
          onBlur={() => { if (!newComment.trim()) setFocused(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
          }}
          placeholder="Leave a comment..."
          rows={1}
          className="w-full px-3.5 py-3 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
        />
        {(focused || newComment.trim()) && (
          <div className="flex items-center justify-end px-3 pb-2.5 gap-1.5">
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              className="p-1.5 rounded-md bg-accent text-white disabled:opacity-30 hover:bg-accent/90 transition-colors"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
