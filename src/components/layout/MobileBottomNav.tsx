'use client'

import { LayoutDashboard, LayoutGrid, Search } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useMobile } from '@/hooks/useMobile'

export function MobileBottomNav() {
  const isMobile = useMobile()
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const panelMode = useUIStore((s) => s.panelMode)
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)

  // Only show on mobile, hide when panel is open
  if (!isMobile || panelMode !== 'closed') return null

  const tabs = [
    { id: 'dashboard' as const, label: '대시보드', icon: LayoutDashboard },
    { id: 'canvas' as const, label: '캔버스', icon: LayoutGrid },
    { id: 'search' as const, label: '검색', icon: Search },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border pb-safe">
      <div className="flex items-center h-14">
        {tabs.map((tab) => {
          const isActive = tab.id !== 'search' && activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'search') {
                  toggleCommandPalette()
                } else {
                  setActiveTab(tab.id)
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
