'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { TiptapEditor } from '@/components/shared/TiptapEditor'
import { AssigneePicker } from '@/components/shared/AssigneePicker'
import { CommentSection } from '@/components/comments/CommentSection'
import type { NodeType, NodeStatus } from '@/lib/types/api'

const STATUS_OPTIONS: { value: NodeStatus; label: string; color: string }[] = [
  { value: 'backlog', label: 'Backlog', color: 'bg-status-backlog' },
  { value: 'todo', label: 'Todo', color: 'bg-status-todo' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-status-progress' },
  { value: 'done', label: 'Done', color: 'bg-status-done' },
  { value: 'archived', label: 'Archived', color: 'bg-status-archived' },
]

const PRIORITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'planning', label: '기획' },
  { value: 'feature', label: '기능개발' },
  { value: 'issue', label: '이슈' },
]

type SaveStatus = 'idle' | 'saving' | 'saved'

function ArrowSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const idx = options.findIndex((o) => o.value === value)
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => idx > 0 && onChange(options[idx - 1].value)}
        disabled={idx <= 0}
        className="p-0.5 rounded hover:bg-surface-hover text-text-tertiary disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-caption px-2 py-1 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary flex-1"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => idx < options.length - 1 && onChange(options[idx + 1].value)}
        disabled={idx >= options.length - 1}
        className="p-0.5 rounded hover:bg-surface-hover text-text-tertiary disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export function NodeProperties() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const updateNodeStatus = useNodeStore((s) => s.updateNodeStatus)

  if (!selectedNode) return null

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      })
      if (res.ok) {
        useNodeStore.setState((s) => ({
          selectedNode: s.selectedNode ? { ...s.selectedNode, priority: newPriority } : null,
        }))
        useCanvasStore.getState().updateNodeData(selectedNode.id, { priority: newPriority })
      }
    } catch (err) {
      console.error('Failed to update priority:', err)
    }
  }

  const handleTypeChange = async (newType: string) => {
    const typedNewType = newType as NodeType
    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typedNewType }),
      })
      if (res.ok) {
        useNodeStore.setState((s) => ({
          selectedNode: s.selectedNode ? { ...s.selectedNode, type: typedNewType } : null,
        }))
        useCanvasStore.getState().updateNodeData(selectedNode.id, { type: typedNewType })
      }
    } catch (err) {
      console.error('Failed to update type:', err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-caption text-text-tertiary">상태</label>
        <ArrowSelect
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={selectedNode.status}
          onChange={(v) => updateNodeStatus(selectedNode.id, v)}
        />
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-1">
        <label className="text-caption text-text-tertiary">우선순위</label>
        <ArrowSelect
          options={PRIORITY_OPTIONS}
          value={selectedNode.priority}
          onChange={handlePriorityChange}
        />
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <label className="text-caption text-text-tertiary">타입</label>
        <ArrowSelect
          options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={selectedNode.type}
          onChange={handleTypeChange}
        />
      </div>

      {/* Assignee */}
      <AssigneePicker
        assigneeId={selectedNode.assigneeId}
        assigneeName={selectedNode.assigneeName}
        assigneeAvatarUrl={selectedNode.assigneeAvatarUrl}
        onAssign={async (userId) => {
          try {
            const res = await fetch(`/api/nodes/${selectedNode.id}/assignee`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assigneeId: userId }),
            })
            if (res.ok) {
              const { data } = await res.json()
              useNodeStore.setState((s) => ({
                selectedNode: s.selectedNode ? {
                  ...s.selectedNode,
                  assigneeId: data.assigneeId,
                  assigneeName: data.assignee?.name ?? null,
                  assigneeAvatarUrl: data.assignee?.avatarUrl ?? null,
                } : null,
              }))
              useCanvasStore.getState().updateNodeData(selectedNode.id, {
                assigneeId: data.assigneeId,
                assigneeName: data.assignee?.name ?? null,
                assigneeAvatarUrl: data.assignee?.avatarUrl ?? null,
              })
            }
          } catch (err) {
            console.error('Failed to update assignee:', err)
          }
        }}
      />

      {/* Dates */}
      <div className="text-caption text-text-tertiary flex flex-col gap-1 mt-2 pt-3 border-t border-border">
        <span>
          생성: {new Date(selectedNode.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <span>
          수정: {new Date(selectedNode.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

export function NodeDetailPanel() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const decisions = useNodeStore((s) => s.decisions)
  const sessions = useNodeStore((s) => s.sessions)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const savedTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (selectedNode) {
      setTitleValue(selectedNode.title)
      setSaveStatus('idle')
    }
  }, [selectedNode])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const saveDescription = useCallback(async (value: string) => {
    if (!selectedNode) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: value || null }),
      })
      if (res.ok) {
        const { data } = await res.json()
        useNodeStore.setState((s) => ({
          selectedNode: s.selectedNode ? { ...s.selectedNode, description: data.description } : null,
        }))
        useCanvasStore.getState().updateNodeData(selectedNode.id, { description: data.description })
        setSaveStatus('saved')
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      }
    } catch (err) {
      console.error('Failed to update description:', err)
      setSaveStatus('idle')
    }
  }, [selectedNode])

  const handleDescUpdate = useCallback((md: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => saveDescription(md), 500)
  }, [saveDescription])

  if (!selectedNode) return null

  const handleTitleSave = async () => {
    setEditingTitle(false)
    if (titleValue !== selectedNode.title && titleValue.trim()) {
      try {
        const res = await fetch(`/api/nodes/${selectedNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleValue.trim() }),
        })
        if (res.ok) {
          const { data } = await res.json()
          useNodeStore.setState((s) => ({
            selectedNode: s.selectedNode ? { ...s.selectedNode, title: data.title } : null,
          }))
          useCanvasStore.getState().updateNodeData(selectedNode.id, { title: data.title })
        }
      } catch (err) {
        console.error('Failed to update title:', err)
        setTitleValue(selectedNode.title)
      }
    }
  }

  // Helper to find session title by ID
  const getSessionTitle = (sessionId: string | null): string | null => {
    if (!sessionId) return null
    const session = sessions.find((s) => s.id === sessionId)
    return session?.title || null
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* Type + Title */}
      <div className="flex items-center gap-2">
        <NodeTypeIcon type={selectedNode.type} size={20} />
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave()
              if (e.key === 'Escape') {
                setTitleValue(selectedNode.title)
                setEditingTitle(false)
              }
            }}
            className="flex-1 text-section-header text-text-primary bg-transparent border-b-2 border-accent outline-none"
          />
        ) : (
          <h3
            className="flex-1 text-section-header text-text-primary cursor-pointer hover:text-accent transition-colors"
            onClick={() => setEditingTitle(true)}
          >
            {selectedNode.title}
          </h3>
        )}
      </div>

      {/* Sub-node button — all types */}
      <button
        onClick={() => useNodeStore.getState().addSubNode(selectedNode.id, selectedNode.projectId, selectedNode.type)}
        className="flex items-center gap-1.5 text-caption text-accent hover:bg-accent/10 px-2 py-1.5 rounded-button transition-colors w-fit"
      >
        <Plus size={14} />
        <span>하위 {selectedNode.type === 'planning' ? '기획' : selectedNode.type === 'feature' ? '기능' : '이슈'} 추가</span>
      </button>

      {/* Description - Notion-like inline markdown editor */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-caption text-text-tertiary">설명</label>
          {saveStatus !== 'idle' && (
            <span
              data-testid="save-status"
              className={`text-caption ${saveStatus === 'saving' ? 'text-text-tertiary' : 'text-green-600'}`}
            >
              {saveStatus === 'saving' ? '저장 중...' : '저장됨'}
            </span>
          )}
        </div>

        <TiptapEditor
          key={selectedNode.id}
          content={selectedNode.description || ''}
          onUpdate={handleDescUpdate}
          placeholder="설명을 추가하세요... (Markdown 지원)"
        />
      </div>

      {/* Decisions */}
      <div>
        <label className="text-caption text-text-tertiary mb-2 block">
          결정사항 ({decisions.length})
        </label>
        {decisions.length === 0 ? (
          <p className="text-caption text-text-tertiary">
            아직 결정사항이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {decisions.map((d) => {
              const sessionTitle = getSessionTitle(d.sessionId)
              return (
                <div
                  key={d.id}
                  className="p-2 rounded-badge bg-surface-hover text-caption text-text-primary"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-accent">{'\u2B50'}</span>
                    <span
                      data-testid="decision-source"
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-tertiary"
                    >
                      {d.sessionId
                        ? `세션: ${sessionTitle || d.sessionId.slice(0, 8)}`
                        : '직접 추가'}
                    </span>
                  </div>
                  {d.content.length > 120 ? d.content.slice(0, 120) + '...' : d.content}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Comments */}
      <CommentSection nodeId={selectedNode.id} />
    </div>
  )
}
