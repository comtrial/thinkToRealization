'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, ChevronRight, Trash2 } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useUIStore } from '@/stores/ui-store'
import { TiptapEditor } from '@/components/shared/TiptapEditor'
import { AssigneePicker } from '@/components/shared/AssigneePicker'
import { CommentSection } from '@/components/comments/CommentSection'
import type { NodeType, NodeStatus, EdgeResponse } from '@/lib/types/api'

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

const STATUS_DOT_COLORS: Record<string, string> = {
  backlog: 'bg-status-backlog',
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  done: 'bg-status-done',
  archived: 'bg-status-archived',
}

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
        className="text-caption px-2 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus-ring"
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
        useUIStore.getState().invalidateDashboard()
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
        useUIStore.getState().invalidateDashboard()
      }
    } catch (err) {
      console.error('Failed to update type:', err)
    }
  }

  const handleDueDateChange = async (dateStr: string) => {
    const newDueDate = dateStr ? new Date(dateStr).toISOString() : null
    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: newDueDate }),
      })
      if (res.ok) {
        useNodeStore.setState((s) => ({
          selectedNode: s.selectedNode ? { ...s.selectedNode, dueDate: newDueDate } : null,
        }))
        useCanvasStore.getState().updateNodeData(selectedNode.id, { dueDate: newDueDate })
      }
    } catch (err) {
      console.error('Failed to update due date:', err)
    }
  }

  const dueDateValue = selectedNode.dueDate
    ? new Date(selectedNode.dueDate).toISOString().split('T')[0]
    : ''

  return (
    <div className="flex flex-col gap-3">
      {/* Status / Priority / Type — single row */}
      <div className="flex items-end gap-3">
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
      </div>

      {/* Assignee — own row */}
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
              useUIStore.getState().invalidateDashboard()
            }
          } catch (err) {
            console.error('Failed to update assignee:', err)
          }
        }}
      />

      {/* Due Date */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-text-tertiary">Due Date</label>
        <input
          type="date"
          value={dueDateValue}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="text-caption px-2 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus-ring"
        />
      </div>

      {/* Dates */}
      <div className="text-[11px] text-text-tertiary flex flex-col gap-1.5 mt-1 pt-3 border-t border-border/30">
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

// Hierarchy section: parent + children
function NodeHierarchy() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const selectNode = useNodeStore((s) => s.selectNode)
  const openPanel = useUIStore((s) => s.openPanel)
  const canvasNodes = useCanvasStore((s) => s.nodes)

  if (!selectedNode) return null

  // Look up parent node data from canvas
  const parentNodeId = selectedNode.parentNodeId
  const parentCanvasNode = parentNodeId
    ? canvasNodes.find((n) => n.id === parentNodeId)
    : null
  const parentTitle = parentCanvasNode
    ? (parentCanvasNode.data as Record<string, unknown>)?.title as string
    : null

  // Derive child nodes from outEdges (parent_child type)
  const nodeWithEdges = selectedNode as unknown as {
    outEdges?: EdgeResponse[]
  }
  const childEdges = (nodeWithEdges.outEdges ?? []).filter(
    (e) => e.type === 'parent_child'
  )
  const childNodes = childEdges
    .map((edge) => {
      const canvasNode = canvasNodes.find((n) => n.id === edge.toNodeId)
      if (!canvasNode) return null
      const data = canvasNode.data as Record<string, unknown>
      return {
        id: edge.toNodeId,
        title: (data.title as string) || '(untitled)',
        status: (data.status as string) || 'backlog',
      }
    })
    .filter(Boolean) as { id: string; title: string; status: string }[]

  const handleNavigate = (nodeId: string) => {
    selectNode(nodeId)
    openPanel(nodeId)
  }

  if (!parentNodeId && childNodes.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Parent issue */}
      {parentNodeId && (
        <div className="flex items-center gap-1 text-caption text-text-secondary">
          <span className="text-[11px] text-text-tertiary">상위 이슈</span>
          <ChevronRight size={12} className="text-text-tertiary" />
          <button
            onClick={() => handleNavigate(parentNodeId)}
            className="hover:text-accent hover:underline transition-colors truncate max-w-[260px]"
          >
            {parentTitle || parentNodeId.slice(0, 8)}
          </button>
        </div>
      )}

      {/* Child issues */}
      {childNodes.length > 0 && (
        <div>
          <span className="text-[11px] text-text-tertiary block mb-1.5">
            하위 이슈 ({childNodes.length})
          </span>
          <div className="flex flex-col gap-1">
            {childNodes.map((child) => (
              <button
                key={child.id}
                onClick={() => handleNavigate(child.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-caption text-text-primary hover:bg-surface-hover transition-colors text-left group"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[child.status] || 'bg-gray-400'}`}
                />
                <span className="truncate group-hover:text-accent transition-colors">
                  {child.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function NodeDetailPanel() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const decisions = useNodeStore((s) => s.decisions)
  const sessions = useNodeStore((s) => s.sessions)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (selectedNode) {
      setTitleValue(selectedNode.title)
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
    }
  }, [])

  const saveDescription = useCallback(async (value: string) => {
    if (!selectedNode) return
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
      }
    } catch (err) {
      console.error('Failed to update description:', err)
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
          useUIStore.getState().invalidateDashboard()
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

      {/* Hierarchy — parent / children */}
      <NodeHierarchy />

      {/* Description — Notion-like inline markdown editor */}
      <div>
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
          onClick={async () => {
            await useNodeStore.getState().addSubNode(selectedNode.id, selectedNode.projectId, selectedNode.type)
            // Re-fetch node detail to refresh hierarchy (child list)
            await useNodeStore.getState().selectNode(selectedNode.id)
          }}
          className="flex items-center gap-1.5 text-caption text-text-tertiary hover:text-accent px-1 py-1 rounded-button transition-colors"
        >
          <Plus size={14} />
          <span>하위 기획/기능/이슈 추가</span>
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
                      className="text-micro px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-tertiary"
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

      {/* Delete node */}
      <div className="border-t border-border/30 pt-4 mt-2">
        <button
          onClick={async () => {
            const confirmed = window.confirm('이 노드를 삭제하시겠습니까? 삭제된 노드는 archived 상태로 변경됩니다.')
            if (!confirmed) return
            try {
              const res = await fetch(`/api/nodes/${selectedNode.id}`, { method: 'DELETE' })
              if (res.ok) {
                useCanvasStore.getState().removeNode(selectedNode.id)
                useUIStore.getState().closePanel()
                useNodeStore.getState().clearSelection()
                useUIStore.getState().invalidateDashboard()
              }
            } catch (err) {
              console.error('Failed to delete node:', err)
            }
          }}
          className="flex items-center gap-1.5 text-caption text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-button transition-colors w-full justify-center border border-red-200 hover:border-red-300"
        >
          <Trash2 size={14} />
          <span>노드 삭제</span>
        </button>
      </div>
    </div>
  )
}
