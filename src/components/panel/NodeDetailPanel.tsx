'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, ChevronRight, Trash2, MoreHorizontal, Copy, Archive, ClipboardCopy, Check, X, Crosshair } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useNodeStore } from '@/stores/node-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useUIStore } from '@/stores/ui-store'
import { TiptapEditor } from '@/components/shared/TiptapEditor'
import { AssigneePicker } from '@/components/shared/AssigneePicker'
import { CommentSection } from '@/components/comments/CommentSection'
import { useToast } from '@/components/shared/Toast'
import { useProject } from '@/components/providers/ProjectProvider'
import { CompactProperties } from './CompactProperties'
import { AttachmentSection } from './AttachmentSection'
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
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      <label className="text-[11px] text-text-tertiary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-caption px-2 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus-ring w-full"
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

export function NodeProperties({ vertical = false }: { vertical?: boolean }) {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const updateNodeStatus = useNodeStore((s) => s.updateNodeStatus)
  const { addToast } = useToast()

  if (!selectedNode) return null

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === selectedNode.status) return
    const result = await updateNodeStatus(selectedNode.id, newStatus)
    if (!result.ok && result.code !== 'ASSIGNEE_REQUIRED') {
      addToast('error', result.error || '상태 변경 실패')
    }
  }

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

  const assigneeSection = (
    <div className="min-w-0">
      <AssigneePicker
        assigneeId={selectedNode.assigneeId}
        assigneeName={selectedNode.assigneeName}
        assigneeAvatarUrl={selectedNode.assigneeAvatarUrl}
        projectId={selectedNode.projectId}
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
    </div>
  )

  const dueDateSection = (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[11px] text-text-tertiary">Due Date</label>
      <input
        type="date"
        value={dueDateValue}
        onChange={(e) => handleDueDateChange(e.target.value)}
        className="text-caption px-2 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus-ring w-full"
      />
    </div>
  )

  const datesSection = (
    <div className="text-[11px] text-text-tertiary flex flex-col gap-1.5 pt-3 border-t border-border/30">
      <div className="flex justify-between">
        <span>Created</span>
        <span>{new Date(selectedNode.createdAt).toLocaleDateString('ko-KR')}</span>
      </div>
      <div className="flex justify-between">
        <span>Updated</span>
        <span>{new Date(selectedNode.updatedAt).toLocaleDateString('ko-KR')}</span>
      </div>
    </div>
  )

  // Vertical layout for sidebar (Linear-style: each property in its own row)
  if (vertical) {
    return (
      <div className="flex flex-col gap-4">
        <PropertySelect
          label="Status"
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={selectedNode.status}
          onChange={handleStatusChange}
        />
        <PropertySelect
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={selectedNode.priority}
          onChange={handlePriorityChange}
        />
        {assigneeSection}
        <PropertySelect
          label="Type"
          options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={selectedNode.type}
          onChange={handleTypeChange}
        />
        {dueDateSection}
        {datesSection}
      </div>
    )
  }

  // Grid layout for peek/mobile panel (2 columns)
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <PropertySelect
        label="Status"
        options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={selectedNode.status}
        onChange={handleStatusChange}
      />
      {assigneeSection}
      <PropertySelect
        label="Priority"
        options={PRIORITY_OPTIONS}
        value={selectedNode.priority}
        onChange={handlePriorityChange}
      />
      {dueDateSection}
      <PropertySelect
        label="Type"
        options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={selectedNode.type}
        onChange={handleTypeChange}
      />
    </div>
  )
}

// Hierarchy section: parent + children
function NodeHierarchy() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const selectNode = useNodeStore((s) => s.selectNode)
  const openPanel = useUIStore((s) => s.openPanel)
  const canvasNodes = useCanvasStore((s) => s.nodes)

  // Fetch parent and child titles that canvas may not have loaded
  const [parentInfo, setParentInfo] = useState<{ id: string; title: string } | null>(null)
  const [childNodes, setChildNodes] = useState<{ id: string; title: string; status: string }[]>([])

  useEffect(() => {
    if (!selectedNode) return

    // Fetch parent title
    const parentNodeId = selectedNode.parentNodeId
    if (parentNodeId) {
      // Try canvas first
      const parentCN = canvasNodes.find((n) => n.id === parentNodeId)
      if (parentCN) {
        setParentInfo({ id: parentNodeId, title: (parentCN.data as Record<string, unknown>)?.title as string || parentNodeId.slice(0, 8) })
      } else {
        // Fetch from API
        fetch(`/api/nodes/${parentNodeId}`).then(r => r.json()).then(({ data }) => {
          if (data?.title) setParentInfo({ id: parentNodeId, title: data.title })
          else setParentInfo({ id: parentNodeId, title: parentNodeId.slice(0, 8) })
        }).catch(() => setParentInfo({ id: parentNodeId, title: parentNodeId.slice(0, 8) }))
      }
    } else {
      setParentInfo(null)
    }

    // Collect child IDs from multiple sources
    const childIds = new Set<string>()

    // 1) Canvas nodes whose parentNodeId points to this node
    canvasNodes.forEach((cn) => {
      if ((cn.data as Record<string, unknown>)?.parentNodeId === selectedNode.id) {
        childIds.add(cn.id)
      }
    })

    // 2) outEdges with parent_child type
    const nodeWithEdges = selectedNode as unknown as { outEdges?: EdgeResponse[] }
    ;(nodeWithEdges.outEdges ?? [])
      .filter((e) => e.type === 'parent_child')
      .forEach((e) => childIds.add(e.toNodeId))

    if (childIds.size === 0) {
      // 3) Fetch children from API using project nodes endpoint
      fetch(`/api/projects/${selectedNode.projectId}/nodes`).then(r => r.json()).then(({ data }) => {
        if (!data) return setChildNodes([])
        const children = (data as { id: string; title: string; status: string; parentNodeId?: string }[])
          .filter((n) => n.parentNodeId === selectedNode.id)
          .map((n) => ({ id: n.id, title: n.title, status: n.status }))
        setChildNodes(children)
      }).catch(() => setChildNodes([]))
    } else {
      // Resolve titles from canvas or API
      const resolved: { id: string; title: string; status: string }[] = []
      const toFetch: string[] = []
      childIds.forEach((id) => {
        const cn = canvasNodes.find((n) => n.id === id)
        if (cn) {
          const d = cn.data as Record<string, unknown>
          resolved.push({ id, title: (d.title as string) || '(untitled)', status: (d.status as string) || 'backlog' })
        } else {
          toFetch.push(id)
        }
      })
      if (toFetch.length === 0) {
        setChildNodes(resolved)
      } else {
        Promise.all(toFetch.map(id => fetch(`/api/nodes/${id}`).then(r => r.json()).then(({ data }) =>
          data ? { id, title: data.title, status: data.status } : null
        ).catch(() => null))).then((fetched) => {
          setChildNodes([...resolved, ...fetched.filter(Boolean) as { id: string; title: string; status: string }[]])
        })
      }
    }
  }, [selectedNode, canvasNodes])

  if (!selectedNode) return null

  const handleNavigate = (nodeId: string) => {
    selectNode(nodeId)
    openPanel(nodeId)
  }

  if (!parentInfo && childNodes.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Parent issue */}
      {parentInfo && (
        <div className="flex items-center gap-1 text-caption text-text-secondary">
          <span className="text-[11px] text-text-tertiary">상위 이슈</span>
          <ChevronRight size={12} className="text-text-tertiary" />
          <button
            onClick={() => handleNavigate(parentInfo.id)}
            className="hover:text-accent hover:underline transition-colors truncate max-w-[260px]"
          >
            {parentInfo.title}
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

export function NodeDetailPanel({ showProperties = true, onClose }: { showProperties?: boolean; onClose?: () => void }) {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const updateNodeStatus = useNodeStore((s) => s.updateNodeStatus)
  const decisions = useNodeStore((s) => s.decisions)
  const sessions = useNodeStore((s) => s.sessions)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const panelMode = useUIStore((s) => s.panelMode)
  const focusNodeOnCanvas = useUIStore((s) => s.focusNodeOnCanvas)
  const { currentProject } = useProject()
  const { addToast } = useToast()

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [copied, setCopied] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const copiedTimerRef = useRef<NodeJS.Timeout>()

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
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
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

  const handleCopyClaudeScript = useCallback(async () => {
    if (!selectedNode) return

    // Find parent node via parent_child edge (where this node is the target)
    const parentEdge = canvasEdges.find(
      (e) => e.target === selectedNode.id && (e.data as Record<string, unknown>)?.type === 'parent_child'
    )
    let parentText = ''
    if (parentEdge) {
      const parentCanvasNode = canvasNodes.find((n) => n.id === parentEdge.source)
      if (parentCanvasNode) {
        const pd = parentCanvasNode.data as Record<string, unknown>
        const parentTitle = (pd.title as string) || '(untitled)'
        const parentDesc = ((pd.description as string) || '').replace(/<[^>]*>/g, '').trim()
        parentText = `## Parent: ${parentTitle}\n${parentDesc || 'No description'}\n\n`
      }
    }

    const decisionsText = decisions.length > 0
      ? decisions.map((d) => `- ${d.content}`).join('\n')
      : 'None'

    const descriptionRaw = selectedNode.description || ''
    const descriptionText = descriptionRaw.replace(/<[^>]*>/g, '').trim() || 'No description'

    const script = `${parentText}## Context: ${selectedNode.title}
- Type: ${selectedNode.type}
- Status: ${selectedNode.status}
- Priority: ${selectedNode.priority}
- Project: ${currentProject?.title || 'Unknown'}

## Description
${descriptionText}

## Decisions Made
${decisionsText}

## Instructions
위 컨텍스트를 참고하여 이 노드에 대한 작업을 진행해주세요.
프로젝트 경로: ${currentProject?.projectDir || 'Unknown'}`

    try {
      await navigator.clipboard.writeText(script)
      addToast('success', '클립보드에 복사되었습니다')
      setCopied(true)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      addToast('error', '클립보드 복사에 실패했습니다')
    }
  }, [selectedNode, decisions, canvasNodes, canvasEdges, currentProject, addToast])

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
    <div className="px-4 pt-5 pb-4 md:px-8 md:pt-8 flex flex-col gap-6">
      {/* Title — large, like Linear + action menu */}
      <div className="flex items-center gap-1">
        {onClose && (
          <button
            data-testid="panel-close-btn"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover text-text-secondary transition-colors shrink-0 -ml-2"
            title="닫기 (ESC)"
          >
            <X size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
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
              className="w-full text-xl md:text-2xl font-semibold text-text-primary bg-transparent border-b-2 border-accent outline-none"
            />
          ) : (
            <h1
              className="text-xl md:text-2xl font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {selectedNode.title}
            </h1>
          )}
        </div>

        {/* Go to canvas button */}
        <button
          onClick={() => selectedNode && focusNodeOnCanvas(selectedNode.id)}
          className="shrink-0 p-1.5 rounded-button text-text-tertiary hover:text-accent hover:bg-surface-hover transition-colors"
          title="캔버스에서 보기"
        >
          <Crosshair size={16} />
        </button>

        {/* Copy Claude Script button */}
        <button
          onClick={handleCopyClaudeScript}
          className="shrink-0 p-1.5 rounded-button text-text-tertiary hover:text-accent hover:bg-surface-hover transition-colors"
          title="Claude 스크립트 복사"
        >
          {copied ? <Check size={16} className="text-green-600" /> : <ClipboardCopy size={16} />}
        </button>

        {/* Action menu (⋯) */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex-shrink-0 p-1.5 rounded-button hover:bg-surface-hover text-text-tertiary hover:text-text-secondary transition-colors mt-1">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[180px] bg-surface border border-border rounded-dropdown shadow-elevation-2 py-1 z-50"
              sideOffset={4}
              align="end"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-caption text-text-primary hover:bg-surface-hover cursor-pointer outline-none"
                onSelect={() => {
                  navigator.clipboard.writeText(selectedNode.id)
                }}
              >
                <Copy size={14} />
                <span>ID 복사</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-caption text-text-primary hover:bg-surface-hover cursor-pointer outline-none"
                onSelect={async () => {
                  const isArchived = selectedNode.status === 'archived'
                  const targetStatus = isArchived ? 'backlog' : 'archived'
                  const result = await updateNodeStatus(selectedNode.id, targetStatus)
                  if (!result.ok) {
                    addToast('error', result.error || '상태 변경 실패')
                  }
                }}
              >
                <Archive size={14} />
                <span>{selectedNode.status === 'archived' ? '보관 해제' : '보관처리'}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-caption text-red-500 hover:bg-red-50 cursor-pointer outline-none"
                onSelect={async () => {
                  const confirmed = window.confirm('이 노드를 삭제하시겠습니까?')
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
              >
                <Trash2 size={14} />
                <span>노드 삭제</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Properties — compact chips in peek mode, grid in full mode */}
      {showProperties && (
        panelMode === 'peek' ? <CompactProperties /> : <NodeProperties />
      )}

      {/* Description — Notion-like inline markdown editor */}
      <div>
        <TiptapEditor
          key={selectedNode.id}
          content={selectedNode.description || ''}
          onUpdate={handleDescUpdate}
          placeholder="설명을 추가하세요... (Markdown 지원)"
        />
      </div>

      {/* Attachments */}
      <AttachmentSection nodeId={selectedNode.id} />

      {/* Sub-node button + Hierarchy (parent/children) — grouped together */}
      <div className="border-t border-border/30 pt-3">
        <button
          onClick={async () => {
            const newNodeId = await useNodeStore.getState().addSubNode(selectedNode.id, selectedNode.projectId, selectedNode.type)
            if (newNodeId) {
              // Navigate to the new child node's edit view
              await useNodeStore.getState().selectNode(newNodeId)
              useUIStore.getState().openPanelFull(newNodeId)
            }
          }}
          className="flex items-center gap-1.5 text-caption text-text-tertiary hover:text-accent px-1 py-1 rounded-button transition-colors"
        >
          <Plus size={14} />
          <span>하위 기획/기능/이슈 추가</span>
        </button>
        <NodeHierarchy />
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

      {/* Dates — only in non-sidebar layout (sidebar shows dates in NodeProperties vertical) */}
      {showProperties && (
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
      )}

    </div>
  )
}
