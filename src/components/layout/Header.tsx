'use client'

import { useState } from 'react'
import { Menu, Search, LogOut } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { ProjectSelector } from './ProjectSelector'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useMobile } from '@/hooks/useMobile'

export function Header() {
  const { toggleSidebar, activeTab, setActiveTab, toggleCommandPalette } = useUIStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isMobile = useMobile()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <header
      className={`${isMobile ? 'col-span-1' : 'col-span-2'} flex items-center justify-between px-2 md:px-4 border-b border-border bg-surface overflow-hidden`}
      style={{ height: 'var(--header-height)' }}
    >
      {/* Left: menu + project selector */}
      <div className="flex items-center gap-1 md:gap-3 min-w-0 flex-shrink">
        <button
          onClick={toggleSidebar}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover transition-colors flex-shrink-0 focus-ring"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} className="text-text-secondary" />
        </button>
        {!isMobile && (
          <span className="text-node-title-lg text-text-primary font-semibold flex-shrink-0">ThinkToRealization</span>
        )}
        <ProjectSelector />
      </div>

      {/* Center: nav tabs */}
      <nav className="flex items-center gap-0.5 flex-shrink-0">
        {(['dashboard', 'canvas'] as const).map((tab) => (
          <button
            key={tab}
            data-active={activeTab === tab ? 'true' : undefined}
            onClick={() => setActiveTab(tab)}
            className={`px-2 md:px-3 py-1.5 text-caption md:text-body rounded-button transition-colors relative min-h-[44px] focus-ring ${
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

      {/* Right: search + notifications + user */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={toggleCommandPalette}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button border border-border hover:bg-surface-hover transition-colors focus-ring"
        >
          <Search size={14} className="text-text-tertiary" />
          {!isMobile && <span className="text-caption text-text-tertiary ml-2">검색</span>}
          {!isMobile && <kbd className="text-micro px-1 py-0.5 rounded bg-surface-hover border border-border ml-2">⌘K</kbd>}
        </button>

        <NotificationBell />

        {/* User menu */}
        {user && (
          <Popover.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <Popover.Trigger asChild>
              <button className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button hover:bg-surface-hover transition-colors focus-ring">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={26} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="w-[180px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-1.5 z-50"
                sideOffset={8}
                align="end"
              >
                <div className="px-2 py-1.5 border-b border-border mb-1">
                  <p className="text-caption font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-micro text-text-tertiary truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-button text-caption text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  <LogOut size={14} />
                  <span>로그아웃</span>
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </header>
  )
}
