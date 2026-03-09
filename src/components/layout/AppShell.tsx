'use client'

import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { SidePanel } from '@/components/panel/SidePanel'
import { useUIStore } from '@/stores/ui-store'
import { useMobile } from '@/hooks/useMobile'

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const panelMode = useUIStore((s) => s.panelMode)
  const isMobile = useMobile()

  // Calculate main area padding-right when panel is open in peek mode
  const mainPaddingRight =
    isMobile ? '0px' : panelMode === 'peek' ? 'calc(max(40%, 400px))' : '0px'

  return (
    <div
      className="w-screen overflow-hidden bg-background"
      style={{
        /* dvh handles iOS Safari dynamic address bar; vh fallback for older browsers */
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'var(--header-height) 1fr',
        gridTemplateColumns: isMobile
          ? '1fr'
          : `${sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'} 1fr`,
      }}
    >
      <Header />
      {!isMobile && <Sidebar />}
      <main
        className="overflow-hidden relative transition-[padding-right] duration-panel ease-devflow"
        style={{ paddingRight: mainPaddingRight }}
      >
        {children}
        <SidePanel />
      </main>
      {/* Mobile sidebar renders as fixed overlay — outside grid flow */}
      {isMobile && <Sidebar />}
      {/* Mobile bottom navigation — fixed position, outside grid */}
      <MobileBottomNav />
    </div>
  )
}
