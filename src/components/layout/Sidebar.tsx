'use client'

import { Inbox, ListTodo, Plus } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'

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

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside
      className="bg-background border-r border-border flex flex-col overflow-hidden transition-all duration-200 ease-devflow"
      style={{
        width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
      }}
    >
      <div className="flex-1 py-2 px-2 flex flex-col gap-1">
        <SidebarItem
          icon={<Inbox size={18} />}
          label="Inbox"
          collapsed={!sidebarOpen}
        />
        <SidebarItem
          icon={<ListTodo size={18} />}
          label="My Work"
          active
          collapsed={!sidebarOpen}
        />

        {sidebarOpen && (
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-caption text-text-tertiary font-medium">프로젝트</span>
              <button className="p-0.5 rounded hover:bg-surface-hover">
                <Plus size={14} className="text-text-tertiary" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
