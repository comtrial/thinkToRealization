'use client'

import { useState, useRef, useEffect } from 'react'
import { useNodeStore } from '@/stores/node-store'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
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
  { value: 'idea', label: 'Idea' },
  { value: 'decision', label: 'Decision' },
  { value: 'task', label: 'Task' },
  { value: 'issue', label: 'Issue' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'note', label: 'Note' },
]

export function NodeDetailPanel() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const decisions = useNodeStore((s) => s.decisions)
  const updateNodeStatus = useNodeStore((s) => s.updateNodeStatus)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (selectedNode) {
      setTitleValue(selectedNode.title)
      setDescValue(selectedNode.description || '')
    }
  }, [selectedNode])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (editingDesc && descInputRef.current) {
      descInputRef.current.focus()
    }
  }, [editingDesc])

  if (!selectedNode) return null

  const handleTitleSave = async () => {
    setEditingTitle(false)
    if (titleValue !== selectedNode.title && titleValue.trim()) {
      try {
        await fetch(`/api/nodes/${selectedNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleValue.trim() }),
        })
      } catch (err) {
        console.error('Failed to update title:', err)
        setTitleValue(selectedNode.title)
      }
    }
  }

  const handleDescSave = async () => {
    setEditingDesc(false)
    if (descValue !== (selectedNode.description || '')) {
      try {
        await fetch(`/api/nodes/${selectedNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: descValue || null }),
        })
      } catch (err) {
        console.error('Failed to update description:', err)
        setDescValue(selectedNode.description || '')
      }
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
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

      {/* Status + Priority + Type */}
      <div className="flex gap-3 flex-wrap">
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-caption text-text-tertiary">상태</label>
          <select
            value={selectedNode.status}
            onChange={(e) => updateNodeStatus(selectedNode.id, e.target.value)}
            className="text-caption px-2 py-1 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-caption text-text-tertiary">우선순위</label>
          <select
            value={selectedNode.priority}
            onChange={async (e) => {
              try {
                await fetch(`/api/nodes/${selectedNode.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ priority: e.target.value }),
                })
              } catch (err) {
                console.error('Failed to update priority:', err)
              }
            }}
            className="text-caption px-2 py-1 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className="text-caption text-text-tertiary">타입</label>
          <select
            value={selectedNode.type}
            onChange={async (e) => {
              try {
                await fetch(`/api/nodes/${selectedNode.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: e.target.value }),
                })
              } catch (err) {
                console.error('Failed to update type:', err)
              }
            }}
            className="text-caption px-2 py-1 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">설명</label>
        {editingDesc ? (
          <textarea
            ref={descInputRef}
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={handleDescSave}
            rows={4}
            className="w-full text-body text-text-primary bg-surface-hover border border-border rounded-node p-2 outline-none focus:border-accent resize-y"
          />
        ) : (
          <div
            className="text-body text-text-secondary cursor-pointer p-2 rounded-node hover:bg-surface-hover transition-colors min-h-[40px]"
            onClick={() => setEditingDesc(true)}
          >
            {selectedNode.description || '설명을 추가하세요...'}
          </div>
        )}
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
            {decisions.map((d) => (
              <div
                key={d.id}
                className="p-2 rounded-badge border border-border bg-surface-hover text-caption text-text-primary"
              >
                <span className="text-accent mr-1">{'\u2B50'}</span>
                {d.content.length > 120 ? d.content.slice(0, 120) + '...' : d.content}
              </div>
            ))}
          </div>
        )}
      </div>

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
