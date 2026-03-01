'use client'

import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SidePanel } from '@/components/panel/SidePanel'
import { useUIStore } from '@/stores/ui-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const panelMode = useUIStore((s) => s.panelMode)

  // Calculate main area padding-right when panel is open in peek mode
  const mainPaddingRight =
    panelMode === 'peek' ? 'calc(max(40%, 400px))' : '0px'

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-background"
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--header-height) 1fr',
        gridTemplateColumns: `${sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'} 1fr`,
      }}
    >
      <Header />
      <Sidebar />
      <main
        className="overflow-hidden relative transition-[padding-right] duration-panel ease-devflow"
        style={{ paddingRight: mainPaddingRight }}
      >
        {children}
        <SidePanel />
      </main>
    </div>
  )
}
