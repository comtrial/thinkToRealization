'use client'

import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Circle,
  SignalLow,
  SignalMedium,
  SignalHigh,
  AlertTriangle,
  Minus,
  Calendar,
  Lightbulb,
  Code2,
  Bug,
  User,
} from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useUIStore } from '@/stores/ui-store'
import { UserAvatar } from '@/components/shared/UserAvatar'
import type { NodeType, NodeStatus, UserResponse } from '@/lib/types/api'

// Status options with dot colors for chips
const STATUS_OPTIONS: { value: NodeStatus; label: string; dotColor: string; bgColor: string }[] = [
  { value: 'backlog', label: 'Backlog', dotColor: 'bg-status-backlog', bgColor: 'bg-slate-50 hover:bg-slate-100' },
  { value: 'todo', label: 'Todo', dotColor: 'bg-status-todo', bgColor: 'bg-slate-50 hover:bg-slate-100' },
  { value: 'in_progress', label: 'In Progress', dotColor: 'bg-status-progress', bgColor: 'bg-yellow-50 hover:bg-yellow-100' },
  { value: 'done', label: 'Done', dotColor: 'bg-status-done', bgColor: 'bg-green-50 hover:bg-green-100' },
  { value: 'archived', label: 'Archived', dotColor: 'bg-status-archived', bgColor: 'bg-gray-50 hover:bg-gray-100' },
]

const PRIORITY_OPTIONS: { value: string; label: string; icon: typeof SignalHigh }[] = [
  { value: 'none', label: 'None', icon: Minus },
  { value: 'low', label: 'Low', icon: SignalLow },
  { value: 'medium', label: 'Medium', icon: SignalMedium },
  { value: 'high', label: 'High', icon: SignalHigh },
  { value: 'urgent', label: 'Urgent', icon: AlertTriangle },
]

const TYPE_OPTIONS: { value: NodeType; label: string; icon: typeof Lightbulb; color: string }[] = [
  { value: 'planning', label: '기획', icon: Lightbulb, color: 'text-type-idea' },
  { value: 'feature', label: '기능개발', icon: Code2, color: 'text-type-task' },
  { value: 'issue', label: '이슈', icon: Bug, color: 'text-type-issue' },
]

// Reusable chip with popover dropdown
function ChipSelect({
  trigger,
  options,
  value,
  onChange,
}: {
  trigger: React.ReactNode
  options: { value: string; label: string; element?: React.ReactNode }[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-[160px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-1 z-50"
          sideOffset={4}
          align="start"
        >
          <ul className="flex flex-col gap-0.5">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-button text-xs transition-colors ${
                    opt.value === value
                      ? 'bg-surface-active text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {opt.element}
                  <span>{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// Assignee chip with user picker popover
function AssigneeChip({
  assigneeId,
  assigneeName,
  assigneeAvatarUrl,
  onAssign,
  projectId,
}: {
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatarUrl: string | null
  onAssign: (userId: string | null) => void
  projectId?: string
}) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserResponse[]>([])

  useEffect(() => {
    if (open && users.length === 0) {
      const url = projectId ? `/api/projects/${projectId}/members` : '/api/users'
      fetch(url)
        .then((r) => r.json())
        .then((json) => {
          if (projectId) {
            const members = (json.data ?? []) as { user: UserResponse }[]
            setUsers(members.map((m) => m.user))
          } else {
            setUsers(json.data ?? [])
          }
        })
        .catch(() => {})
    }
  }, [open, users.length, projectId])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-stone-100 hover:bg-stone-200 cursor-pointer transition-colors max-w-[140px]">
          {assigneeId && assigneeName ? (
            <>
              <UserAvatar name={assigneeName} avatarUrl={assigneeAvatarUrl} size={14} />
              <span className="text-text-primary truncate">{assigneeName}</span>
            </>
          ) : (
            <>
              <User size={12} className="text-text-tertiary shrink-0" />
              <span className="text-text-tertiary">미배정</span>
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-[200px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-1.5 z-50"
          sideOffset={4}
          align="start"
        >
          {/* Unassign option */}
          {assigneeId && (
            <button
              onClick={() => {
                onAssign(null)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-button text-xs text-text-tertiary hover:bg-surface-hover transition-colors mb-0.5"
            >
              <Minus size={14} />
              <span>배정 해제</span>
            </button>
          )}
          {users.length === 0 ? (
            <p className="text-xs text-text-tertiary px-2 py-1">사용자 없음</p>
          ) : (
            <ul className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    onClick={() => {
                      onAssign(user.id)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-button text-xs transition-colors ${
                      user.id === assigneeId
                        ? 'bg-surface-active text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={16} />
                    <span className="truncate">{user.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function CompactProperties() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const updateNodeStatus = useNodeStore((s) => s.updateNodeStatus)

  if (!selectedNode) return null

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === selectedNode.status)
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === selectedNode.priority)
  const currentType = TYPE_OPTIONS.find((t) => t.value === selectedNode.type)
  const PriorityIcon = currentPriority?.icon ?? Minus

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

  const handleAssign = async (userId: string | null) => {
    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}/assignee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: userId }),
      })
      if (res.ok) {
        const { data } = await res.json()
        useNodeStore.setState((s) => ({
          selectedNode: s.selectedNode
            ? {
                ...s.selectedNode,
                assigneeId: data.assigneeId,
                assigneeName: data.assignee?.name ?? null,
                assigneeAvatarUrl: data.assignee?.avatarUrl ?? null,
              }
            : null,
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
  }

  const dueDateFormatted = selectedNode.dueDate
    ? new Date(selectedNode.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null

  const dueDateValue = selectedNode.dueDate
    ? new Date(selectedNode.dueDate).toISOString().split('T')[0]
    : ''

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Status chip */}
      <ChipSelect
        value={selectedNode.status}
        onChange={(v) => updateNodeStatus(selectedNode.id, v)}
        options={STATUS_OPTIONS.map((s) => ({
          value: s.value,
          label: s.label,
          element: <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotColor}`} />,
        }))}
        trigger={
          <button
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${currentStatus?.bgColor ?? 'bg-stone-100 hover:bg-stone-200'}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${currentStatus?.dotColor ?? 'bg-gray-400'}`} />
            <span className="text-text-primary">{currentStatus?.label ?? selectedNode.status}</span>
          </button>
        }
      />

      {/* Priority chip */}
      <ChipSelect
        value={selectedNode.priority}
        onChange={handlePriorityChange}
        options={PRIORITY_OPTIONS.map((p) => {
          const Icon = p.icon
          return {
            value: p.value,
            label: p.label,
            element: <Icon size={12} className={p.value === 'urgent' ? 'text-orange-500' : 'text-text-tertiary'} />,
          }
        })}
        trigger={
          <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-stone-100 hover:bg-stone-200 cursor-pointer transition-colors">
            <PriorityIcon
              size={12}
              className={`shrink-0 ${selectedNode.priority === 'urgent' ? 'text-orange-500' : 'text-text-tertiary'}`}
            />
            <span className="text-text-primary">{currentPriority?.label ?? selectedNode.priority}</span>
          </button>
        }
      />

      {/* Type chip */}
      <ChipSelect
        value={selectedNode.type}
        onChange={handleTypeChange}
        options={TYPE_OPTIONS.map((t) => {
          const Icon = t.icon
          return {
            value: t.value,
            label: t.label,
            element: <Icon size={12} className={t.color} />,
          }
        })}
        trigger={
          <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-stone-100 hover:bg-stone-200 cursor-pointer transition-colors">
            {currentType ? (
              <currentType.icon size={12} className={`shrink-0 ${currentType.color}`} />
            ) : (
              <Circle size={12} className="text-text-tertiary shrink-0" />
            )}
            <span className="text-text-primary">{currentType?.label ?? selectedNode.type}</span>
          </button>
        }
      />

      {/* Assignee chip */}
      <AssigneeChip
        assigneeId={selectedNode.assigneeId}
        assigneeName={selectedNode.assigneeName}
        assigneeAvatarUrl={selectedNode.assigneeAvatarUrl}
        onAssign={handleAssign}
        projectId={selectedNode.projectId}
      />

      {/* Due date chip */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-stone-100 hover:bg-stone-200 cursor-pointer transition-colors">
            <Calendar size={12} className="text-text-tertiary shrink-0" />
            <span className={dueDateFormatted ? 'text-text-primary' : 'text-text-tertiary'}>
              {dueDateFormatted ?? '마감일'}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="bg-surface border border-border rounded-dropdown shadow-elevation-2 p-2 z-50"
            sideOffset={4}
            align="start"
          >
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {selectedNode.dueDate && (
              <button
                onClick={() => handleDueDateChange('')}
                className="mt-1 w-full text-xs text-text-tertiary hover:text-red-500 py-1 transition-colors"
              >
                마감일 해제
              </button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
