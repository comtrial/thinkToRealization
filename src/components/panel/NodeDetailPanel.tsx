'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useCanvasStore } from '@/stores/canvas-store'
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

function PropertySelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-text-tertiary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-caption px-2 py-1.5 rounded-button border border-border/60 bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
      {/* Status / Priority / Type — compact vertical list */}
      <PropertySelect
        label="Status"
        options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={selectedNode.status}
        onChange={(v) => updateNodeStatus(selectedNode.id, v)}
      />
      <PropertySelect
        label="Priority"
        options={PRIORITY_OPTIONS}
        value={selectedNode.priority}
        onChange={handlePriorityChange}
      />
      <PropertySelect
        label="Type"
        options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={selectedNode.type}
        onChange={handleTypeChange}
      />

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
      <div className="text-[11px] text-text-tertiary flex flex-col gap-1.5 mt-1 pt-3 border-t border-border/40">
        <div className="flex justify-between">
          <span>Created</span>
          <span>{new Date(selectedNode.createdAt).toLocaleDateString('ko-KR')}</span>
        </div>
        <div className="flex justify-between">
          <span>Updated</span>
          <span>{new Date(selectedNode.updatedAt).toLocaleDateString('ko-KR')}</span>
        </div>
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
    <div className="px-8 pt-8 pb-4 flex flex-col gap-6">
      {/* Title — large, like Linear */}
      <div>
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
            className="w-full text-2xl font-semibold text-text-primary bg-transparent border-b-2 border-accent outline-none"
          />
        ) : (
          <h1
            className="text-2xl font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
            onClick={() => setEditingTitle(true)}
          >
            {selectedNode.title}
          </h1>
        )}
      </div>

      {/* Description — Notion-like inline markdown editor */}
      <div>
        {saveStatus !== 'idle' && (
          <div className="flex justify-end mb-1">
            <span
              data-testid="save-status"
              className={`text-[11px] ${saveStatus === 'saving' ? 'text-text-tertiary' : 'text-green-600'}`}
            >
              {saveStatus === 'saving' ? '저장 중...' : '저장됨'}
            </span>
          </div>
        )}
        <TiptapEditor
          key={selectedNode.id}
          content={selectedNode.description || ''}
          onUpdate={handleDescUpdate}
          placeholder="설명을 추가하세요... (Markdown 지원)"
        />
      </div>

      {/* Sub-node button — below description, like Linear's "+ Add sub-issues" */}
      <div className="border-t border-border/30 pt-3">
        <button
          onClick={() => useNodeStore.getState().addSubNode(selectedNode.id, selectedNode.projectId, selectedNode.type)}
          className="flex items-center gap-1.5 text-caption text-text-tertiary hover:text-accent px-1 py-1 rounded-button transition-colors"
        >
          <Plus size={14} />
          <span>Add sub-issues</span>
        </button>
      </div>

      {/* Decisions */}
      {decisions.length > 0 && (
        <div>
          <label className="text-caption text-text-tertiary mb-2 block">
            결정사항 ({decisions.length})
          </label>
          <div className="flex flex-col gap-2">
            {decisions.map((d) => {
              const sessionTitle = getSessionTitle(d.sessionId)
              return (
                <div
                  key={d.id}
                  className="p-2.5 rounded-lg bg-surface-hover/60 text-caption text-text-primary"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-accent">{'\u2B50'}</span>
                    <span
                      data-testid="decision-source"
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border/60 text-text-tertiary"
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
        </div>
      )}

      {/* Activity / Comments — Linear style */}
      <CommentSection nodeId={selectedNode.id} />
    </div>
  )
}
