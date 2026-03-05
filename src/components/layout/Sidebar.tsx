'use client'

import { useState, useMemo } from 'react'
import { ListTodo, Plus, FolderOpen, X, Bug } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useProject } from '@/components/providers/ProjectProvider'
import { CreateProjectDialog } from '@/components/layout/CreateProjectDialog'
import { useMobile } from '@/hooks/useMobile'
import { StatusDot } from '@/components/shared/Badge'
import type { NodeStatus } from '@/lib/types/api'

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  collapsed?: boolean
  onClick?: () => void
}

function SidebarItem({ icon, label, active, collapsed, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-button text-body transition-colors ${
        active
          ? 'bg-surface-active text-text-primary border-l-2 border-accent'
          : 'text-text-secondary hover:bg-surface-hover'
      } ${collapsed ? 'justify-center px-0' : ''}`}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

const ISSUE_STATUS_FILTERS: { value: NodeStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: '진행 중' },
  { value: 'done', label: '완료' },
]

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const openPanel = useUIStore((s) => s.openPanel)
  const { currentProject, setCurrentProject, projects } = useProject()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [issueStatusFilter, setIssueStatusFilter] = useState<NodeStatus | 'all'>('all')
  const isMobile = useMobile()
  const canvasNodes = useCanvasStore((s) => s.nodes)

  const issueNodes = useMemo(() => {
    const issues = canvasNodes.filter((n) => {
      const data = n.data as Record<string, unknown>
      return data.type === 'issue' && data.status !== 'archived'
    })
    if (issueStatusFilter === 'all') return issues
    return issues.filter((n) => (n.data as Record<string, unknown>).status === issueStatusFilter)
  }, [canvasNodes, issueStatusFilter])

  const sidebarContent = (
    <div className="flex-1 py-2 px-2 flex flex-col gap-1 overflow-y-auto">
      <SidebarItem
        icon={<ListTodo size={18} />}
        label="My Work"
        collapsed={!isMobile && !sidebarOpen}
      />

      {(isMobile || sidebarOpen) && (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-caption text-text-tertiary font-medium">프로젝트</span>
              <button
                data-testid="create-project-btn"
                onClick={() => setCreateDialogOpen(true)}
                className={`rounded hover:bg-surface-hover ${isMobile ? 'min-w-[44px] min-h-[44px] flex items-center justify-center' : 'p-0.5'}`}
                title="새 프로젝트"
              >
                <Plus size={14} className="text-text-tertiary" />
              </button>
            </div>
            <div data-testid="project-list" className="flex flex-col gap-0.5">
              {projects.map((project) => (
                <SidebarItem
                  key={project.id}
                  icon={<FolderOpen size={16} />}
                  label={project.title}
                  active={currentProject?.id === project.id}
                  onClick={() => {
                    setCurrentProject(project)
                    if (isMobile) toggleSidebar()
                  }}
                />
              ))}
            </div>
          </div>

          {/* Issue list panel */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 px-3 mb-1">
                <Bug size={14} className="text-type-issue" />
                <span className="text-caption text-text-tertiary font-medium">이슈</span>
                <span className="text-[10px] text-text-tertiary ml-auto">{issueNodes.length}</span>
              </div>
              {/* Status filter */}
              <div className="flex gap-1 px-3 mb-2 flex-wrap">
                {ISSUE_STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setIssueStatusFilter(f.value)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-badge transition-colors ${
                      issueStatusFilter === f.value
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-tertiary hover:bg-surface-hover'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Issue items */}
              <div className="flex flex-col gap-0.5 px-1">
                {issueNodes.length === 0 ? (
                  <p className="text-[10px] text-text-tertiary px-2 py-1">이슈가 없습니다</p>
                ) : (
                  issueNodes.map((node) => {
                    const data = node.data as Record<string, unknown>
                    return (
                      <button
                        key={node.id}
                        onClick={() => {
                          openPanel(node.id)
                          if (isMobile) toggleSidebar()
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-button text-left hover:bg-surface-hover transition-colors w-full"
                      >
                        <StatusDot status={data.status as NodeStatus} />
                        <span className="text-caption text-text-primary truncate flex-1">
                          {data.title as string}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  if (isMobile) {
    if (!sidebarOpen) return <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

    return (
      <>
        {/* Backdrop — below header (z-30), covers main content */}
        <div
          className="fixed inset-0 z-40 bg-black/40"
          style={{ top: 'var(--header-height)' }}
          onClick={toggleSidebar}
        />
        {/* Sidebar panel — below header, with close button */}
        <aside
          className="fixed left-0 bottom-0 w-[280px] z-50 bg-background border-r border-border flex flex-col overflow-hidden"
          style={{ top: 'var(--header-height)' }}
        >
          {/* Close button */}
          <div className="flex items-center justify-end px-2 py-1 border-b border-border">
            <button
              onClick={toggleSidebar}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover"
              aria-label="사이드바 닫기"
            >
              <X size={18} className="text-text-secondary" />
            </button>
          </div>
          {sidebarContent}
        </aside>
        <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </>
    )
  }

  return (
    <>
      <aside
        className="bg-background border-r border-border flex flex-col overflow-hidden transition-all duration-200 ease-devflow"
        style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
        }}
      >
        {sidebarContent}
      </aside>

      <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </>
  )
}
