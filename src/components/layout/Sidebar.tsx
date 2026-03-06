'use client'

import { useState, useMemo } from 'react'
import { ListTodo, Plus, ChevronDown, Check, FolderOpen, X, Bug, Inbox, LayoutGrid, MoreHorizontal } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
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
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-button text-body transition-colors ${
        active
          ? 'bg-surface-active text-text-primary font-medium'
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
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const openPanel = useUIStore((s) => s.openPanel)
  const { currentProject, setCurrentProject, projects } = useProject()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [issueStatusFilter, setIssueStatusFilter] = useState<NodeStatus | 'all'>('all')
  const isMobile = useMobile()
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const isCollapsed = !isMobile && !sidebarOpen

  const issueNodes = useMemo(() => {
    const issues = canvasNodes.filter((n) => {
      const data = n.data as Record<string, unknown>
      return data.type === 'issue' && data.status !== 'archived'
    })
    if (issueStatusFilter === 'all') return issues
    return issues.filter((n) => (n.data as Record<string, unknown>).status === issueStatusFilter)
  }, [canvasNodes, issueStatusFilter])

  const sidebarContent = (
    <div className="flex-1 py-2 flex flex-col overflow-y-auto">
      {/* Workspace navigation */}
      <div className="flex flex-col gap-0.5 px-2 mb-3">
        <SidebarItem icon={<Inbox size={16} />} label="Inbox" collapsed={isCollapsed} />
        <SidebarItem
          icon={<ListTodo size={16} />}
          label="대시보드"
          active={activeTab === 'dashboard'}
          collapsed={isCollapsed}
          onClick={() => setActiveTab('dashboard')}
        />
        <SidebarItem
          icon={<LayoutGrid size={16} />}
          label="캔버스"
          active={activeTab === 'canvas'}
          collapsed={isCollapsed}
          onClick={() => setActiveTab('canvas')}
        />
        <SidebarItem icon={<MoreHorizontal size={16} />} label="More" collapsed={isCollapsed} />
      </div>

      {(isMobile || sidebarOpen) && (
        <>
          {/* Separator */}
          <div className="h-px bg-border mx-3 mb-3" />

          {/* Project dropdown */}
          <div className="px-2 mb-3">
            <Popover.Root open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
              <Popover.Trigger asChild>
                <button
                  data-testid="project-list"
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-button text-body text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <FolderOpen size={16} className="text-text-secondary flex-shrink-0" />
                  <span className="truncate flex-1 text-left">
                    {currentProject ? currentProject.title : '프로젝트 선택'}
                  </span>
                  <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="w-[200px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-1.5 z-50"
                  sideOffset={4}
                  align="start"
                >
                  <ul className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
                    {projects.map((project) => {
                      const selected = currentProject?.id === project.id
                      return (
                        <li key={project.id}>
                          <button
                            onClick={() => {
                              setCurrentProject(project)
                              setProjectDropdownOpen(false)
                              if (isMobile) toggleSidebar()
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-button text-caption transition-colors ${
                              selected
                                ? 'bg-surface-active text-text-primary font-medium'
                                : 'text-text-secondary hover:bg-surface-hover'
                            }`}
                          >
                            <span className="truncate flex-1 text-left">{project.title}</span>
                            {selected && <Check size={12} className="text-accent flex-shrink-0" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      data-testid="create-project-btn"
                      onClick={() => { setCreateDialogOpen(true); setProjectDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-button text-caption text-text-secondary hover:bg-surface-hover transition-colors"
                    >
                      <Plus size={12} />
                      <span>새 프로젝트</span>
                    </button>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Issue list panel */}
          {currentProject && (
            <div className="mt-1">
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
        <div
          className="fixed inset-0 z-40 bg-black/40"
          style={{ top: 'var(--header-height)' }}
          onClick={toggleSidebar}
        />
        <aside
          className="fixed left-0 bottom-0 w-[280px] z-50 bg-background border-r border-border flex flex-col overflow-hidden"
          style={{ top: 'var(--header-height)' }}
        >
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
