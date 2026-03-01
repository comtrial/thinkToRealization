'use client'

import { Menu, Search, Settings } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { ProjectSelector } from './ProjectSelector'

export function Header() {
  const { toggleSidebar, activeTab, setActiveTab, toggleCommandPalette } = useUIStore()

  return (
    <header
      className="col-span-2 flex items-center justify-between px-4 border-b border-border bg-surface"
      style={{ height: 'var(--header-height)' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-button hover:bg-surface-hover transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} className="text-text-secondary" />
        </button>
        <span className="text-node-title-lg text-text-primary font-semibold">DevFlow</span>
        <ProjectSelector />
      </div>

      <nav className="flex items-center gap-1">
        {(['dashboard', 'canvas'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-body rounded-button transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'dashboard' ? '대시보드' : '캔버스'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 text-caption text-text-tertiary rounded-button border border-border hover:bg-surface-hover transition-colors"
        >
          <Search size={14} />
          <span>검색</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded bg-surface-hover border border-border">⌘K</kbd>
        </button>
        <button className="p-1.5 rounded-button hover:bg-surface-hover transition-colors">
          <Settings size={18} className="text-text-secondary" />
        </button>
      </div>
    </header>
  )
}
